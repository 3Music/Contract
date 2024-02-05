// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity >0.4.0 <= 0.9.0;

import "./helpers/Ownable.sol";
import "./helpers/Context.sol";
import "./interfaces/IMarketplace.sol";
import "./interfaces/StableCoinContractInterface.sol";
import "./interfaces/IFractionalizedNFT.sol";
import "./libraries/SafeMath.sol";
import "./helpers/ReentrancyGuard.sol";

contract Marketplace is IMarketplace, ReentrancyGuard, Context, Ownable {
    using SafeMath for uint64;
    mapping(uint64 => Item) private _listedItems;
    mapping(address => mapping (string => uint64)) _totalListedAmount;
    mapping(string => address) _nftCreators;
    address private _tokenBank;
    uint64 private _nftCreatorMintShare;
    uint64 private constant SHARE_DECIMALS = 100;
    uint64 private _currentId;
    StableCoinContractInterface _StableCoinContractInterface;
    IFractionalizedNFT _iFractionalizedNFT;

    constructor(address stableCoinContractAddress, address nftContractAddress, uint64 nftCreatorMintShare) {
        _currentId = 0;
        _StableCoinContractInterface = StableCoinContractInterface(stableCoinContractAddress);
        _iFractionalizedNFT = IFractionalizedNFT(nftContractAddress);
        _nftCreatorMintShare = nftCreatorMintShare;
    }

    function getTotalListedAmount(string calldata tokenId) external view returns(uint64) {
        return _totalListedAmount[msg.sender][tokenId];
    }

    function mint(string calldata tokenId, address creator, address buyer, uint64 amount, uint256 price) external onlyOwner {
        _nftCreators[tokenId] = creator;
        uint256 totalPrice = price * amount;
        require(_StableCoinContractInterface.transferFrom(buyer, _tokenBank, totalPrice), "Coin tranfer failed");
        require(_StableCoinContractInterface.transferFrom(_tokenBank, creator, totalPrice * _nftCreatorMintShare / SHARE_DECIMALS),
             "Coin tranfser to creator failed");
        require(_iFractionalizedNFT.mint(tokenId, buyer, amount));
    }

    function listItem(string calldata tokenId, uint64 amount, uint256 price) external {
        require(amount > 0, "Cannot sell 0 tokens");
        uint64 balance = _iFractionalizedNFT.balanceOf(tokenId, msg.sender);
        require(balance >= _totalListedAmount[msg.sender][tokenId] + amount, "Don't have enough tokens to sell");
        _listedItems[_currentId] = Item(msg.sender, tokenId, amount, price);
        _totalListedAmount[msg.sender][tokenId] += amount;
        uint64 id = _currentId;
        _currentId += 1;
        emit ItemListed(id, tokenId, msg.sender, amount, price);
    }

    function purchaseItem(uint64 itemId, uint64 amount, uint64 price) external nonReentrant {
        Item memory item = _listedItems[itemId];
        require(item.amount > 0, "Item is not listed");
        require(msg.sender != item.seller, "Cannot purchase your own item");
        require(item.amount >= amount, "Cannot sell more than amount NFTs");
        require(item.price * amount <= price, "Too low suggested price");
        if (item.amount > amount) {
            _listedItems[itemId].amount = _listedItems[itemId].amount.sub(amount);  
        } else {
            delete _listedItems[itemId];
        }
        _totalListedAmount[item.seller][item.tokenId] = _totalListedAmount[item.seller][item.tokenId].sub(amount);
        require(_StableCoinContractInterface.transferFrom(msg.sender, item.seller, item.price * amount), "stable Coin transfer failed");
        require(_iFractionalizedNFT.transferFrom(item.tokenId, item.seller, msg.sender, amount), "NFT transfer failed");        
        emit ItemPurchased(itemId, msg.sender, item.seller, amount, item.price * amount);
    }

    function updateItemPrice(uint64 itemId, uint256 newPrice) external {
        require(_listedItems[itemId].seller == msg.sender, "Only seller can change price");
        _listedItems[itemId].price = newPrice;
        emit ItemPriceUpdated(itemId, newPrice);
    }

    function delistItem(uint64 itemId) external {
        require(_listedItems[itemId].seller == msg.sender, "Only seller can delist item");
        _totalListedAmount[msg.sender][_listedItems[itemId].tokenId] -= _listedItems[itemId].amount; 
        delete _listedItems[itemId];
        emit ItemDelisted(itemId);
    }

    function getItem(uint64 itemId) external view returns (Item memory item) {
        return _listedItems[itemId];
    }
}
