const FractionalizedNFT = artifacts.require("FractionalizedNFT");
const MockStableCoin = artifacts.require("MockStableCoin");
const Marketplace = artifacts.require("Marketplace");

contract("FractionalizedNFT", (accounts) => {
    let fractionalizedNFT;
    let mockStableCoin;
    let marketplace;
    const nftName = "testNFT";
    const owner = accounts[0];
    const user1 = accounts[1];
    const user2 = accounts[2];

    beforeEach(async () => {
        mockStableCoin = await MockStableCoin.new({ from: owner });
        fractionalizedNFT = await FractionalizedNFT.new(mockStableCoin.address, 1000, 1000, { from: owner });
        marketplace = await Marketplace.new(mockStableCoin.address, fractionalizedNFT.address)
        await fractionalizedNFT.setMaxSupply(nftName, 1000);
        await fractionalizedNFT.mint(nftName, 1000, {from: owner});
        await fractionalizedNFT.transfer(nftName, user1, 500, {from: owner});
        await mockStableCoin.mint(owner, 1000000000);
        await mockStableCoin.approve(fractionalizedNFT.address, 1000000000, {from: owner});
    });

    
    it("listing of an item", async () => {
        let result = await marketplace.listItem(nftName, 300, 200, {from: user1});
        const log = result.logs[0];
        const itemId = log.args.itemId;
        let item = await marketplace.getItem(0);
        assert.equal(user1.address, item.seller.address);
        assert.equal("200", item.price.toString());
        assert.equal("300", item.amount.toString());
        assert.equal(nftName, item.tokenId);
    });

    it("cannot list more than have", async () => {
        try {
            await marketplace.listItem(nftName, 600, 200, {from: user1});
            assert.fail("Cannot list more than you have");
        } catch (error) {
            const revertFound = error.message.search('revert') >= 0;
            assert(revertFound, `Expected "revert", got ${error} instead`);
        }
        await marketplace.listItem(nftName, 300, 200, {from: user1});
        await marketplace.listItem(nftName, 100, 100, {from: user1});
        try {
            await marketplace.listItem(nftName, 200, 100, {from: user1});
            assert.fail("Cannot list more than you have");
        } catch (error) {
            const revertFound = error.message.search('revert') >= 0;
            assert(revertFound, `Expected "revert", got ${error} instead`);
        }        
    });

    it("purchasing the item", async () => {
        await marketplace.listItem(nftName, 300, 200, {from: user1});
        await mockStableCoin.mint(user2, 100000);
        await mockStableCoin.approve(marketplace.address, 60000, {from: user2});
        let user2Balance = await mockStableCoin.balanceOf(user2);
        let user1Balance = await mockStableCoin.balanceOf(user1);
        await fractionalizedNFT.approve(nftName, marketplace.address, 300, {from: user1});
        try {
            await marketplace.purchaseItem(0, 300, 50000, {from: user2});
            assert.fail("Too low suggested price");
        } catch (error) {
            const revertFound = error.message.search('revert') >= 0;
            assert(revertFound, `Expected "revert", got ${error} instead`);
        }  
        await marketplace.purchaseItem(0, 300, 60000, {from: user2});
        let user2BalanceAfter = await mockStableCoin.balanceOf(user2);
        let user1BalanceAfter = await mockStableCoin.balanceOf(user1);
        assert.equal((user2Balance - user2BalanceAfter).toString(), "60000");
        assert.equal((user1BalanceAfter - user1Balance).toString(), "60000");
        let user1NFTBalance = await fractionalizedNFT.balanceOf(nftName, user1);
        let user2NFTBalance = await fractionalizedNFT.balanceOf(nftName, user2);
        assert.equal(user1NFTBalance.toString(), "200");
        assert.equal(user2NFTBalance.toString(), "300");
        let item = await marketplace.getItem(0);
        assert.equal(item.tokenId, "");
    });

    it("updating the price of an item", async () => {
        await marketplace.listItem(nftName, 300, 200, {from: user1});
        let item = await marketplace.getItem(0);
        assert.equal("200", item.price.toString());
        assert.equal(nftName, item.tokenId);
        await marketplace.updateItemPrice(0, 300, {from: user1});
        item = await marketplace.getItem(0);
        assert.equal("300", item.price.toString());
        assert.equal(nftName, item.tokenId);
    });

    it("delisting of an item", async () => {
        await marketplace.listItem(nftName, 300, 200, {from: user1});
        await marketplace.delistItem(0, {from: user1});
        let item = await marketplace.getItem(0);
        assert.equal(item.tokenId, "");
    }); 
});
