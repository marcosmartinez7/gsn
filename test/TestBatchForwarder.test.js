/* global contract artifacts before it */

const Environments = require('../src/js/relayclient/Environments')

const TestPaymasterEverythingAccepted = artifacts.require('TestPaymasterEverythingAccepted.sol')
const RelayHub = artifacts.require('RelayHub.sol')
const TrustedBatchForwarder = artifacts.require('./TrustedBatchForwarder.sol')
const TestRecipient = artifacts.require('TestRecipient.sol')
const { getEip712Signature } = require('../src/js/common/utils')
const getDataToSign = require('../src/js/common/EIP712/Eip712Helper')
const { expectEvent } = require('@openzeppelin/test-helpers')

const RelayRequest = require('../src/js/common/EIP712/RelayRequest')

contract('TrustedBatchForwarder', ([from, relay, relayOwner]) => {
  let paymaster, recipient, hub, forwarder
  let sharedRelayRequestData
  const chainId = Environments.defEnv.chainId

  before(async () => {
    const paymasterDeposit = 1e18.toString()

    hub = await RelayHub.new(16, { gas: 1e7 })
    await hub.stake(relay, 7 * 24 * 3600, {
      from: relayOwner,
      value: 2e18
    })
    await hub.registerRelay(2e16.toString(), '10', 'url', { from: relay })
    paymaster = await TestPaymasterEverythingAccepted.new({ gas: 1e7 })
    await hub.depositFor(paymaster.address, { value: paymasterDeposit })

    recipient = await TestRecipient.new()
    forwarder = await TrustedBatchForwarder.new()
    recipient.setTrustedForwarder(forwarder.address)

    await paymaster.setRelayHub(hub.address)

    sharedRelayRequestData = {
      senderAddress: from,
      senderNonce: '1',
      target: recipient.address,
      pctRelayFee: '1',
      baseRelayFee: '0',
      gasPrice: await web3.eth.getGasPrice(),
      gasLimit: 1e6.toString(),
      relayAddress: from,
      paymaster: paymaster.address
    }
  })

  context('#sendBatch', async () => {
    it('should send all methods in the batch', async () => {
      const relayRequest = new RelayRequest({
        ...sharedRelayRequestData,
        senderNonce: (await hub.getNonce(recipient.address, from)).toString(),
        target: forwarder.address,
        gasPrice: 1e6.toString(),
        encodedFunction: forwarder.contract.methods.sendBatch([recipient.address, recipient.address],
          [
            recipient.contract.methods.emitMessage('hello').encodeABI(),
            recipient.contract.methods.emitMessage('world').encodeABI()
          ]).encodeABI()
      })

      const dataToSign = await getDataToSign({
        chainId,
        verifier: forwarder.address,
        relayRequest
      })
      const signature = await getEip712Signature({
        web3,
        dataToSign
      })

      const ret = await hub.relayCall(relayRequest, signature, '0x', {
        from: relay
      })

      // console.log(getLogs(ret))
      const relayed = ret.logs.find(log => log.event === 'TransactionRelayed')
      assert.equal(relayed.args.status, 0)

      const logs = await recipient.getPastEvents({ fromBlock: 1 })
      const testevents = logs.filter(e => e.event === 'SampleRecipientEmitted')
      assert.equal(testevents.length, 2)
      assert.equal(testevents[0].args.realSender, from)
    })

    it('should revert all requests if one fails', async () => {
      const relayRequest = new RelayRequest({
        ...sharedRelayRequestData,
        senderNonce: (await hub.getNonce(recipient.address, from)).toString(),
        target: forwarder.address,
        gasPrice: 1e6.toString(),
        encodedFunction: forwarder.contract.methods.sendBatch([recipient.address, recipient.address],
          [
            recipient.contract.methods.emitMessage('hello').encodeABI(),
            recipient.contract.methods.testRevert().encodeABI()
          ]).encodeABI()
      })

      const dataToSign = await getDataToSign({
        chainId,
        verifier: forwarder.address,
        relayRequest
      })
      const signature = await getEip712Signature({
        web3,
        dataToSign
      })

      const ret = await hub.relayCall(relayRequest, signature, '0x', {
        from: relay
      })
      expectEvent(ret, 'TransactionRelayed', { status: '1' })
    })

    it('should not batch with wrong # of params', async () => {
      const relayRequest = new RelayRequest({
        ...sharedRelayRequestData,
        senderNonce: (await hub.getNonce(recipient.address, from)).toString(),
        target: forwarder.address,
        gasPrice: 1e6.toString(),
        encodedFunction: forwarder.contract.methods.sendBatch([recipient.address, recipient.address],
          [
            recipient.contract.methods.emitMessage('hello').encodeABI()
          ]).encodeABI()
      })

      const dataToSign = await getDataToSign({
        chainId,
        verifier: forwarder.address,
        relayRequest
      })
      const signature = await getEip712Signature({
        web3,
        dataToSign
      })

      const ret = await hub.relayCall(relayRequest, signature, '0x', {
        from: relay
      })
      expectEvent(ret, 'TransactionRelayed', { status: '1' })
    })
  })
})
