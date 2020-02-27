pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./utils/EIP712Sig.sol";
import "./interfaces/ITrustedForwarder.sol";

contract TrustedForwarder is ITrustedForwarder {

    EIP712Sig private eip712sig;
    constructor() public {
        eip712sig = new EIP712Sig(address (this));
    }

    function verify(EIP712Sig.RelayRequest memory req, bytes memory sig) view public returns(bool){
        return eip712sig.verify(req,sig);
    }

    function verifyAndCall(EIP712Sig.RelayRequest memory req, bytes memory sig) public returns (bool success, bytes memory ret) {
        if (!verify(req, sig) )
            return (false, "can't call: wrong signature");
        return req.callData.target.call.gas(req.callData.gasLimit)
        (abi.encodePacked(req.callData.encodedFunction, req.relayData.senderAccount));
    }
}
