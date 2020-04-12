pragma solidity ^0.5.16;
/* solhint-disable avoid-low-level-calls */

//calculate gas usage from within a function.
// this is a simplified model of RelayHub, just for calculating gas.
// each method knows its gaslimit (by getting it as parameter.)
// outer exec can calculate its gas usage exactly (with a known offset)
// inner "internalExec" can tell with some bias and
contract GasCalculator {

    uint public constant MSG_LEN_FACTOR = 97;
    uint public constant OVERHEAD = 2933;

    function exec(uint externalGasLimit, bytes calldata func) external {
        //        uint gas = gasleft();

        uint usedSoFar = msg.data.length * MSG_LEN_FACTOR / 32 + OVERHEAD;
        //some pre-innercall code
        //default calculation gives just a bit too little.
        uint innerGasLimit = gasleft() * 62 / 64 - 5000;
        usedSoFar += externalGasLimit - gasleft() + innerGasLimit;
        (bool success, bytes memory data) = address(this).call.gas(innerGasLimit)(abi.encodeWithSelector(this.internalFunc.selector,
            usedSoFar, func
            ));
        (success);
        uint calcGas = externalGasLimit - gasleft();
        //actual total gas (inner+outer_
        uint innerCalcGas = abi.decode(data, (uint));
        //inner-calculated total gas
        emit UsedGas(calcGas, innerCalcGas);
    }

    event UsedGas(uint calcGas, uint innerCalcGas);

    event InnerGas(uint innerGasLimit, uint gasleft);

    function internalFunc(uint usedSoFar, bytes calldata func) external returns (uint innerCalcGas) {

        (bool success,) = address(this).call(func);
        (success);

        innerCalcGas = usedSoFar - gasleft();
    }

    function emitdata(bytes calldata data) external {
        emit Debug(data);
    }

    //just waste gas (unrelated to data size)
    function wastecpu(uint count, bytes calldata data) external view {
        (this, data);
        uint sum = 0;
        for (uint i = 0; i < count; i++) {
            sum = sum * 1001 + i;
        }
    }

    event Debug(bytes data);

    /* solhint-disable no-empty-blocks */
    function empty(bytes calldata data) external {
    }
}
