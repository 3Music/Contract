// SPDX-License-Identifier: MIT
pragma solidity >0.4.0 <= 0.9.0;

import "./libraries/SafeMath.sol";
import "./helpers/Ownable.sol";
import "./helpers/Context.sol";
import "./helpers/Approvable.sol";
import "./interfaces/IFractionalizedNFT.sol";
import "./interfaces/StableCoinContractInterface.sol";


contract FractionalizedNFT is Context, IFractionalizedNFT, Ownable, Approvable {
  using SafeMath for uint64;

  uint64 public constant BALANCES_DECIMALS = 100;
  mapping (address => mapping(string => uint64)) private _userNFTs;

  mapping (address => mapping (address => mapping(string => uint64))) private _allowances;

  mapping (string => uint64) private _totalSupply;

  StableCoinContractInterface _StableCoinContractInterface;

  constructor(address _StableCoinContractAddress) {
    _StableCoinContractInterface = StableCoinContractInterface(_StableCoinContractAddress);
  }  

  function getOwner() external view returns (address) {
    return owner();
  }

  function totalSupply(string calldata id) external view returns (uint64) {
    return _totalSupply[id];
  }

  function balanceOf(string calldata id, address account) external view returns (uint64) {
    return _userNFTs[account][id];
  }

  function transfer(string calldata id, address recipient, uint64 amount) external returns (bool) {
    _transfer(id, _msgSender(), recipient, amount);
    return true;
  }

  function allowance(string calldata id, address owner, address spender) external view returns (uint64) {
    return _allowances[owner][spender][id];
  }

  function approve(string calldata id, address spender, uint64 amount) external returns (uint256) {
    uint256 previousAllowance = _allowances[_msgSender()][spender][id];
    _approve(id, _msgSender(), spender, amount);
    return previousAllowance;
  }

  function transferFrom(string calldata id, address sender, address recipient, uint64 amount) external returns (bool) {
    _transfer(id, sender, recipient, amount);
    _approve(id, sender, _msgSender(), _allowances[sender][_msgSender()][id].sub(amount, "transfer amount exceeds allowance"));
    return true;
  }

  function increaseAllowance(string calldata id, address spender, uint64 addedValue) public returns (bool) {
    _approve(id, _msgSender(), spender, _allowances[_msgSender()][spender][id].add(addedValue));
    return true;
  }

  function decreaseAllowance(string calldata id, address spender, uint64 subtractedValue) public returns (bool) {
    _approve(id, _msgSender(), spender, _allowances[_msgSender()][spender][id].sub(subtractedValue, "decreased allowance below zero"));
    return true;
  }

  function mint(string calldata id, address owner, uint64 amount) external onlyApproved returns (bool) {
    _mint(id, owner, amount);
    return true;
  }

  function _transfer(string calldata id, address sender, address recipient, uint64 amount) internal {
    require(sender != address(0), "transfer from the zero address");
    require(recipient != address(0), "transfer to the zero address");    
    _userNFTs[sender][id] = _userNFTs[sender][id].sub(amount, "transfer amount exceeds balance");
    _userNFTs[recipient][id] = _userNFTs[recipient][id].add(amount);
    emit Transfer(id, sender, recipient, amount);
  }

  function _mint(string calldata id, address account, uint64 amount) internal {
    require(account != address(0), "mint to the zero address");
    require(amount > 0, "cannot mint 0 tokens");
    _totalSupply[id] = _totalSupply[id].add(amount);
    _userNFTs[account][id] = _userNFTs[account][id].add(amount);    
    emit Transfer(id, address(0), account, amount);
  }

  function _approve(string calldata id, address owner, address spender, uint64 amount) internal {
    require(owner != address(0), "approve from the zero address");
    require(spender != address(0), "approve to the zero address");

    _allowances[owner][spender][id] = amount;
    emit Approval(id, owner, spender, amount);
  }
}