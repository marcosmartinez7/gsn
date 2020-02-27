pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;
import "../utils/EIP712Sig.sol";

contract ITrustedForwarder {

    function init(address _hub) public;

    //verify the signature matches the request.
    // that is, the senderAccount is the signer
    function verify(EIP712Sig.RelayRequest memory req, bytes memory sig) view public returns(bool);

    //validate the signature, and execute the call.
    function verifyAndCall(EIP712Sig.RelayRequest memory req, bytes memory sig) public returns (bool success, bytes memory ret);
}
