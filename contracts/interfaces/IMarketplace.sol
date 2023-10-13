// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity >0.4.0 <= 0.9.0;

interface IMarketplace {

    event ItemListed(uint64 itemId, string tokenId, address indexed seller, uint64 amount, uint256 price);
    event ItemPurchased(uint64 itemId, address indexed buyer, address indexed seller, uint64 amount, uint256 price);
    event ItemPriceUpdated(uint64 itemId, uint256 newPrice);
    event ItemDelisted(uint64 itemId);

    struct Item {
        address seller;
        string tokenId;
        uint64 amount;
        uint256 price;
    }

    function listItem(string calldata tokenId, uint64 amount, uint256 price) external;

    function purchaseItem(uint64 itemId, uint64 amount, uint64 price) external;

    function updateItemPrice(uint64 itemId, uint256 newPrice) external;

    function delistItem(uint64 itemId) external;

    function getItem(uint64 itemId) external view returns (Item memory item);
}
