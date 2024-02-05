// SPDX-License-Identifier: MIT
pragma solidity >0.4.0 <= 0.9.0;

import "./Context.sol";


contract Approvable is Context {
  address[] private _approved;

  /**
   * @dev Initializes the contract setting the deployer as the initial owner.
   */
  constructor ()  {
  }

  /**
   * @dev Returns the address of the current owner.
   */
  function approved() public view returns (address[] memory) {
    return _approved;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyApproved() {
    bool isApproved = false;
    for (uint i = 0; i < _approved.length; i++) {
        if (_approved[i] == _msgSender()) {
            isApproved = true;
            break;
        }
    }
    require(isApproved, "Sender is not approved");
    _;
  }

  function approveAddress(address account) external onlyApproved {
    _approved.push(account);
  }

}