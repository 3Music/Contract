// SPDX-License-Identifier: MIT
pragma solidity >0.4.0 <= 0.9.0;

// Interface for the external contract
interface StableCoinContractInterface {
    function transfer(address recipient, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}
