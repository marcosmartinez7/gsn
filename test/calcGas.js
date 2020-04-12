// eslint-disable

const GasCalculator = artifacts.require('GasCalculator.sol')

var logged
function logline( items ) {
  if ( logged ) {
    console.log(Object.values(items).join("\t"))
  } else {
    console.log(Object.keys(items).join("\t"))
    logged=true
  }
}
contract.skip('GasCalculator', ([from]) => {
  let gasCalc

  async function call (len, lenzero = 0) {
    if (!len && lenzero) return
    const gas = 2e6
    const data = '0x'+'1'.repeat(len * 2) + '0'.repeat(lenzero * 2)

    const func = await gasCalc.contract.methods.empty(data).encodeABI()
    //use cpu-waster to verify that actual gas usd by inner function doesn't change estimation
    // const func = await gasCalc.contract.methods.wastecpu(len, '0x'+'1'.repeat(4000)).encodeABI()
    const exec = gasCalc.contract.methods.exec(gas, func)
    const estimExec = await exec.estimateGas()
    const msgDataLength = (await exec.encodeABI().replace(/0x/,'')).length/2
    const len32 = Math.ceil(msgDataLength/32)-8
    const ret = await gasCalc.exec(gas,func, {gas,from})

    const logs = ret.logs
    // convert events into easily-digestable format: remove unused numeric, __length fields,
    // convert all numbers
    function packArgs (args) {
      return args.filter(([name]) => name.match(/^[^_\d]/))
        .reduce((s, [k, v]) => ({
          ...s,
          [k]: parseInt(v.toString())
        }), {})
    }
    const args = packArgs(Object.entries(logs.find(e => e.event === 'UsedGas').args))


    // console.log('inner gas',  innerGas)

    const { calcGas, innerCalcGas } = args
    const gasUsed = ret.receipt.gasUsed
    const innerCalcDiff = gasUsed - innerCalcGas
    const calcGasDiff = gasUsed - calcGas
    logline({msgDataLength, calcGas, gasUsed, innerCalcGas, innerCalcDiff, calcGasDiff })
  }

  it('test gas', async () => {
    gasCalc = await GasCalculator.new()
    const gas = 1e6
    let ret
    const len1 = 500
    const len2 = 1000
    await call(0)
    await call(10)
    await call(40)
    await call(30, 10)
    await call(0, 40)
    await call(100, 0)
    await call(0, 100)
    await call(200, 0)
    await call(0, 200)
    await call(300, 0)
    await call(0, 300)
    await call(600, 0)
    await call(0, 600)
    await call(1000, 0)
    await call(2000, 0)
    await call(3000, 0)
    await call(4000, 0)
    await call(5000, 0)
    await call(6000, 0)
    await call(7000, 0)
    await call(8000, 0)
    await call(9000, 0)
    await call(10000, 0)

  })
})
