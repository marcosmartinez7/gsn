#!/usr/bin/env node
import Web3 from 'web3'
import rp from 'request-promise'

const networks = {
  local: 'http://127.0.0.1:8545',
  xdai: 'https://dai.poa.network',
  ropsten: 'https://ropsten.infura.io/v3/c3422181d0594697a38defe7706a1e5b',
  rinkeby: 'https://rinkeby.infura.io/v3/c3422181d0594697a38defe7706a1e5b',
  kovan: 'https://kovan.infura.io/v3/c3422181d0594697a38defe7706a1e5b',
  mainnet: 'https://mainnet.infura.io/v3/c3422181d0594697a38defe7706a1e5b'
}

const net = process.argv[2]

const network = networks[net] || (net && net.match(/^(https?:.*)?/)[0])

if (!network) {
  console.log('usage: gsn-stat {network} [hubaddr]')
  console.log('  - network: url or one of: ' + Object.keys(networks))
  console.log('  - hubaddr: explicit address of a RelayHub (by default, looks for hub with active relays on the network)')
  process.exit(1)
}

const BLOCK_HISTORY_COUNT = process.env.N || 6000

const GETADDR_TIMEOUT = (process.env.T || 1) * 1000

let hubaddr = process.argv[3]

const web3 = new Web3(new Web3.providers.HttpProvider(network))
const RelayHubAbi = require('../src/relayclient/IRelayHub')

const owners = {}

function owner (h) {
  if (!owners[h]) { owners[h] = 'owner-' + (Object.keys(owners).length + 1) }
  return owners[h]
}

function same (a, b) {
  return a.toUpperCase() === b.toUpperCase()
}

async function run () {
  console.log('network: ', network)

  const curBlockNumber = await web3.eth.getBlockNumber()

  const fromBlock = Math.max(1, curBlockNumber - BLOCK_HISTORY_COUNT)

  if (!hubaddr) {
    // all relayed messages in the past time period.
    const allRelayAddedMessages = await web3.eth.getPastLogs({
      fromBlock,
      topics: [web3.utils.sha3('RelayAdded(address,address,uint256,uint256,uint256,string)')]
    })
    const relayHubs = [...new Set(allRelayAddedMessages.map(r => r.address))]

    if (relayHubs.length === 0) {
      console.log('Not RelayHub (with active relays) found. try to specify address')
      process.exit(1)
    }

    if (relayHubs.length > 1) {
      console.log('Found multiple active relay hubs. select one:', relayHubs)
      process.exit(1)
    }
    hubaddr = relayHubs[0]

    // TODO: actually, can extract all info from the above returned RelayAdded messages.
    // however, we need to format them for our contract
  }

  const hubBalanceAsync = web3.eth.getBalance(hubaddr)
  const gasPriceAsync = web3.eth.getGasPrice()
  const r = new web3.eth.Contract(RelayHubAbi, hubaddr)
  const pastEventsAsync = r.getPastEvents('RelayAdded', { fromBlock })

  console.log('hub balance (deposits, stakes)=', (await hubBalanceAsync) / 1e18)
  console.log('hub address', hubaddr)
  console.log('gas price: ', (await gasPriceAsync))
  console.log('current block: ', curBlockNumber)

  const res = await pastEventsAsync

  const relays = {}
  const waiters = []
  res.forEach(e => {
    const r = e.returnValues

    waiters.push(rp({ url: r.url + '/getaddr', timeout: GETADDR_TIMEOUT, json: true })
      .then(ret => {
        const version = ret.Version || ''
        relays[r.relay].status = !same(r.relay, ret.RelayServerAddress) ? 'addr-mismatch @' + e.blockNumber //            ret.RelayServerAddress
          : ret.Ready ? 'Ready ' + version : 'pending ' + version
      }
      ).catch(err => {
        relays[r.relay].status = err.error && err.error.code ? err.error.code : err.message || err.toString()
      }))
    waiters.push(web3.eth.getBalance(r.relay).then(bal => {
      relays[r.relay].bal = bal / 1e18
    }))

    const aowner = owner(r.owner)
    // console.log( e.blockNumber, e.event, r.url, aowner )
    relays[r.relay] = { addr: r.relay, url: r.url, owner: aowner, pctRelayFee: r.transactionFee, status: 'no answer' }
  })
  await Promise.all(waiters)
  console.log('\n# Relays:')
  Object.values(relays).sort((a, b) => a.owner > b.owner).forEach(r => console.log('-', r.addr.slice(2, 10), r.url, '\t' + r.owner, '\tpctRelayFee:' + r.pctRelayFee + '%', '\tbal', r.bal, '\t' + r.status))

  console.log('\n# Owners:')
  Object.keys(owners).forEach(k => {
    const ethBalance = web3.eth.getBalance(k)
    const relayBalance = r.methods.balanceOf(k).call()
    Promise.all([ethBalance, relayBalance]).then(async () => {
      console.log('-', owners[k], ':', k, 'on-hub:', (await relayBalance) / 1e18, '\tbal', (await ethBalance) / 1e18)
    })
  })
}

run()
