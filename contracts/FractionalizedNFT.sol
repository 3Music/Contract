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

  struct NFTStats {
    uint64 balance;
    uint256 totalPayout;
  }

  uint64 public constant BALANCES_DECIMALS = 100;
  uint256 private _nftStreamCost;
  uint256 private _streamPrice;
  uint64 private _chargedStreamsCount;
  uint64 private _totalPaidStreams;
  mapping (address => mapping(string => NFTStats)) private _userNFTs;
  mapping (string => uint256) private _nftTotalPayouts;
  mapping (string => uint64) private _nftTotalStreams;

  mapping (address => mapping (address => mapping(string => uint64))) private _allowances;

  mapping (string => uint64) private _totalSupply;
  mapping (string => uint64) private _maxSupply;
  uint64 private _tokensMaxSupply;

  StableCoinContractInterface _StableCoinContractInterface;

  constructor(address _StableCoinContractAddress) {
    _StableCoinContractInterface = StableCoinContractInterface(_StableCoinContractAddress);
    _chargedStreamsCount = 0;
    _totalPaidStreams = 0;
  }  

  function getOwner() external view returns (address) {
    return owner();
  }

  function totalSupply(string calldata id) external view returns (uint64) {
    return _totalSupply[id];
  }

  function maxSupply(string calldata id) external view returns (uint64) {
    return _maxSupply[id];
  }

  function setMaxSupply(uint64 nftMaxSupply) external onlyOwner returns (bool) {
    _tokensMaxSupply = nftMaxSupply;
    return true;
  }

  function balanceOf(string calldata id, address account) external view returns (uint64) {
    return _userNFTs[account][id].balance;
  }

  function setNFTStreamCost(uint256 cost) external onlyOwner returns (bool) {
    _nftStreamCost = cost;
    return true;
  }

  function NFTStreamCost() external view returns (uint256) {
    return _nftStreamCost;
  }

  function setStreamPrice(uint256 price) external onlyOwner returns (bool) {
    _streamPrice = price;
    return true;
  }

  function streamPrice() external view returns (uint256) {
    return _streamPrice;
  }

  function chargedStreams() external view returns (uint64) {
    return _chargedStreamsCount;
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

  function setStreams(string[] calldata ids, uint64[] calldata streamsCount) external onlyOwner returns(bool) {
    for (uint i = 0; i < ids.length; i++) {
      require(_nftTotalStreams[ids[i]] < streamsCount[i]);
      _nftTotalPayouts[ids[i]] = _nftTotalPayouts[ids[i]] + (streamsCount[i] - _nftTotalStreams[ids[i]]) * _nftStreamCost;
      _nftTotalStreams[ids[i]] = streamsCount[i];
    }
    return true;
  }

  function transferStableCoin(address recipient, uint256 amount) internal returns(bool) {
    _StableCoinContractInterface.transfer(recipient, amount);
    return true;
  }

  function transferFromStableCoin(address sender, address recipient, uint256 amount) internal returns(bool) {
    _StableCoinContractInterface.transferFrom(sender, recipient, amount);
    return true;
  }

  function payForStreams(address user, string[] calldata ids) internal returns (uint256) {
    mapping (string => NFTStats) storage userNFTS = _userNFTs[user];
    uint256 totalPayout = 0;
    for (uint i = 0; i < ids.length; i++) {
      uint256 totalNFTProfit = _nftTotalPayouts[ids[i]];
      uint256 payout_amount = (totalNFTProfit - userNFTS[ids[i]].totalPayout) * userNFTS[ids[i]].balance / _maxSupply[ids[i]];
      totalPayout += payout_amount;
      userNFTS[ids[i]].totalPayout = totalNFTProfit;
    }
    transferFromStableCoin(owner(), user, totalPayout);
    return totalPayout;
  }

  function payForStreams(address user, string calldata id) internal returns (uint256) {
    mapping (string => NFTStats) storage userNFTS = _userNFTs[user];
    uint256 totalPayout = 0;
    uint256 payout_amount = (_nftTotalPayouts[id] - userNFTS[id].totalPayout) * userNFTS[id].balance / _maxSupply[id];
    totalPayout += payout_amount;
    userNFTS[id].totalPayout = _nftTotalPayouts[id];
    transferFromStableCoin(owner(), user, totalPayout);
    return totalPayout;
  }

  function collectNFTsIncome(string[] calldata ids) external returns (bool) {
    uint256 totalPayout = payForStreams(_msgSender(), ids);
    emit PaidForStreams(_msgSender(), totalPayout);
    return true;
  }

  function chargeForStreams(address[] calldata users, uint64[] calldata streamCounts) external onlyOwner returns (bool) {
    uint64 totalCharged = 0;
    for (uint i = 0; i < users.length; i++) {
      totalCharged += streamCounts[i];
      transferFromStableCoin(users[i], _msgSender(), streamCounts[i] * _streamPrice);
    }
    _chargedStreamsCount += totalCharged;
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
    payForStreams(sender, id);
    if (_userNFTs[recipient][id].balance > 0) {
      payForStreams(recipient, id);
    }    
    uint64 senderBalance = _userNFTs[sender][id].balance.sub(amount, "transfer amount exceeds balance");
    if (senderBalance == 0) {
      delete _userNFTs[sender][id];
    } else {
      _userNFTs[sender][id].balance = senderBalance;
    }
    _userNFTs[recipient][id].balance = _userNFTs[recipient][id].balance.add(amount);
    _userNFTs[recipient][id].totalPayout = _nftTotalPayouts[id];
    emit Transfer(id, sender, recipient, amount);
  }

  function _mint(string calldata id, address account, uint64 amount) internal {
    require(account != address(0), "mint to the zero address");
    require(amount > 0, "cannot mint 0 tokens");
    uint64 tokenMaxSupply = _maxSupply[id];
    if (tokenMaxSupply == 0) {
      tokenMaxSupply = _tokensMaxSupply;    
      _maxSupply[id] = tokenMaxSupply;
    }
    uint64 currentTotalSupply = _totalSupply[id];
    require(tokenMaxSupply >= currentTotalSupply + amount, "Cannot mint more than max supply");

    _totalSupply[id] = currentTotalSupply.add(amount);
    NFTStats memory userNFTStats = _userNFTs[account][id];
    userNFTStats.balance = userNFTStats.balance.add(amount);
    userNFTStats.totalPayout = _nftTotalPayouts[id];
    _userNFTs[account][id] = userNFTStats;
    
    emit Transfer(id, address(0), account, amount);
  }

  function _approve(string calldata id, address owner, address spender, uint64 amount) internal {
    require(owner != address(0), "approve from the zero address");
    require(spender != address(0), "approve to the zero address");

    _allowances[owner][spender][id] = amount;
    emit Approval(id, owner, spender, amount);
  }
}