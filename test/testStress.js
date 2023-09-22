const FractionalizedNFT = artifacts.require("FractionalizedNFT");
const MockStableCoin = artifacts.require("MockStableCoin");
const Marketplace = artifacts.require("Marketplace");
const BN = web3.utils.BN;


contract("Stress Test", (accounts) => {
    let fractionalizedNFT;
    let mockStableCoin;
    let marketplace;
    let nftNames = [];
    const maxTokensAmount = 100;
    const owner = accounts[0];
    const listedMap = new Map();
    const listedUserItems = new Map();
    const random = Math.random();
    let listedItems = new Map();
    let listedCounter = 0;
    let purchasedCounter = 0;
    let delistedCounter = 0;
    let updatedCounter = 0;
    let collectedCounter = 0;


    beforeEach(async () => {
        mockStableCoin = await MockStableCoin.new({ from: owner });
        fractionalizedNFT = await FractionalizedNFT.new(mockStableCoin.address, 1000, 1000, { from: owner });
        marketplace = await Marketplace.new(mockStableCoin.address, fractionalizedNFT.address);
        await mockStableCoin.mint(owner, 1000000000);
        await mockStableCoin.approve(fractionalizedNFT.address, 1000000000, {from: owner});
        for (let i = 0; i < 10; i++) {
            nftNames.push(i.toString())
            await fractionalizedNFT.setMaxSupply(nftNames[i], 100000);
            await fractionalizedNFT.mint(nftNames[i], 100000, {from: owner});
        }
        for (let i = 0; i < accounts.length; i++) {
            await mockStableCoin.mint(accounts[i], 100000);
            listedUserItems.set(accounts[i], new Map())
        }
        for (j = 0; j < accounts.length; j++) {        
            listedMap.set(accounts[j], new Map());                  
            for (let i = 0; i < nftNames.length; i++) {
                listedMap.get(accounts[j]).set(nftNames[i], 0);
                await fractionalizedNFT.transfer(nftNames[i], accounts[j], maxTokensAmount, {from: owner});
            }
        }
    });

    async function listItem(account, nftName, amount, price) {
        let amountBN = new BN(amount);
        let currentAllowance = await fractionalizedNFT.allowance(nftName, account, fractionalizedNFT.address);
        console.log("ALLOWANCE", currentAllowance);
        await fractionalizedNFT.increaseAllowance(nftName, marketplace.address, amountBN, {from: account});
        currentAllowance = await fractionalizedNFT.allowance(nftName, account, fractionalizedNFT.address);
        console.log("ALLOWANCE", currentAllowance);
        let result = await marketplace.listItem(nftName, amount, price, {from: account});
        const log = result.logs[0];
        const itemId = log.args.itemId;
        listedMap.get(account).set(nftName, listedMap.get(account).get(nftName) + amount)
        listedItems.set(itemId, true);
        listedUserItems.get(account).set(itemId, true);
        return itemId;
    }

    async function listItemPipe(account, nftName, amount, price) {
        let accountBalance = await fractionalizedNFT.balanceOf(nftName, account);
        console.log("BALANCE");
        console.log(accountBalance);
        console.log(listedMap.get(account).get(nftName));
        if (accountBalance >= listedMap.get(account).get(nftName) + amount) {
            let itemId = await listItem(account, nftName, amount, price);
            let item = await marketplace.getItem(itemId);
            assert.equal(account, item.seller);
            assert.equal(price.toString(), item.price.toString());
            assert.equal(amount.toString(), item.amount.toString());
            assert.equal(nftName, item.tokenId);
            listedCounter += 1;
            return itemId;
        } else {
            try {
                await listItem(account, nftName, amount, price);
                assert.fail("TransferFrom more than balance");
            } catch (error) {
                const revertFound = error.message.search('revert') >= 0;
                let total = await marketplace.getTotalListedAmount(nftName, {from: account});
                assert(revertFound, `${error.message}, total ${total}, AccountBalance ${accountBalance}, listedMap ${listedMap.get(account).get(nftName)}, amount ${amount}`);
            }
            return -1;
        }
    }

    async function purchaseItem(account, itemId, price_, amount) {
        let currentAllowance = await mockStableCoin.allowance(account, fractionalizedNFT.address);
        let price = new BN(price_);
        let item = await marketplace.getItem(itemId)
        let currentAllowanceNFT = await fractionalizedNFT.allowance(item.tokenId, item.seller, marketplace.address);
        let currentAllowanceNFTBN = new BN(currentAllowanceNFT);
        console.log("ALLOWANCE", currentAllowanceNFT);
        let amountBN = new BN(amount);
        if (amountBN.gt(currentAllowanceNFTBN)) {
            let balance = await fractionalizedNFT.balanceOf(item.tokenId, item.seller);
            assert(false, `bal ${balance}, eq ${item.amount == amount}, iam ${item.amount}, cabn ${currentAllowanceNFTBN}, abn ${amountBN}, itemId ${itemId}`);
        }
        await mockStableCoin.approve(marketplace.address, currentAllowance.add(price), {from: account});
        await marketplace.purchaseItem(itemId, amount, price, {from: account});        
        listedMap.get(item.seller).set(item.tokenId, listedMap.get(item.seller).get(item.tokenId) - amount)        
        if (amount.toString() == item.amount.toString()) {
            listedItems.delete(itemId);
            listedUserItems.get(account).delete(itemId);
        } else {
            let itemAfter = await marketplace.getItem(itemId);
            assert.equal(amount.toString(), (item.amount - itemAfter.amount).toString());
        }
    }

    async function purchaseItemPipe(account, itemId) {
        let accountBalance = await mockStableCoin.balanceOf(account);
        let item = await marketplace.getItem(itemId);
        console.log(item)
        let amount = getRandomInt(0, item.amount)
        if (getRandomInt(0, 100) < 10) {
            amount = item.amount;
        }         
        let price = item.price * amount;
        if (getRandomInt(0, 100) < 5) {
            price = item.price * amount / 2;
        }        
        let sellerBalance = await mockStableCoin.balanceOf(item.seller);
        let isOnSale = item.amount > 0;
        let isNotSeller = account != item.seller;
        let isEnoughPrice = item.price * amount <= price;
        let isEnoughTokens = item.amount >= amount;
        let isEnoughBalance = accountBalance >= price;
        let sellerBalanceNFT = await fractionalizedNFT.balanceOf(item.tokenId, item.seller);
        let accountBalanceNFT = await fractionalizedNFT.balanceOf(item.tokenId, account);
        let sellerBalanceNFTBN = new BN(sellerBalanceNFT);
        let amountBN = new BN(amount);
        let isEnoughSellerTokens = sellerBalanceNFTBN.gte(amountBN);
        if (isOnSale && isNotSeller && isEnoughBalance && isEnoughPrice && isEnoughTokens && isEnoughTokens && isEnoughSellerTokens) {
            await purchaseItem(account, itemId, price, amount);
            let accountBalanceAfter = await mockStableCoin.balanceOf(account);
            assert.equal((accountBalance - accountBalanceAfter).toString(), price.toString());
            let sellerBalanceAfter = await mockStableCoin.balanceOf(item.seller);
            assert.equal((sellerBalanceAfter - sellerBalance).toString(), price.toString());
            let accountBalanceNFTAfter = await fractionalizedNFT.balanceOf(item.tokenId, account);
            let sellerBalanceNFTAfter = await fractionalizedNFT.balanceOf(item.tokenId, item.seller);
            assert.equal((accountBalanceNFTAfter -accountBalanceNFT).toString(), amount.toString());
            assert.equal((sellerBalanceNFT - sellerBalanceNFTAfter).toString(), amount.toString());
            purchasedCounter += 1;
        } else {
            try {
                await purchaseItem(account, itemId, price, amount);
                assert.fail("TransferFrom more than balance");
            } catch (error) {
                const revertFound = error.message.search('revert') >= 0;
                assert(revertFound, `isOnSale ${isOnSale}, isNotSeller ${isNotSeller}, isEnoughPrice ${isEnoughPrice}, isEnoughTokens ${isEnoughTokens}, isEnoughBalance ${isEnoughBalance}, isEnoughSellerTokens ${isEnoughSellerTokens}, sellerBalance ${sellerBalanceNFT}, amount ${amount}`);
            }
        }
    }

    async function delistItem(account, itemId) {
        let item = await marketplace.getItem(itemId);
        let nftName = item.tokenId;
        await fractionalizedNFT.decreaseAllowance(nftName, marketplace.address, item.amount, {from: account});
        await marketplace.delistItem(itemId, {from: account});
        listedMap.get(account).set(nftName, listedMap.get(account).get(nftName) - item.amount);
        listedItems.delete(itemId);
        delistedCounter += 1;
        listedUserItems.get(account).delete(itemId);
    }

    async function updateItemPrice(nftName, account, itemId, price) {
        await marketplace.updateItemPrice(itemId, price, {from: account});
        updatedCounter += 1;
    }

    async function collectNFTsIncome(account, nftNames) {
        let ownerBalance = await mockStableCoin.balanceOf(owner);
        let accountBalance = await mockStableCoin.balanceOf(account);
        let result = await fractionalizedNFT.collectNFTsIncome(nftNames, {from: account});        
        let ownerBalanceAfter = await mockStableCoin.balanceOf(owner);
        let accountBalanceAfter = await mockStableCoin.balanceOf(account);
        assert.equal((ownerBalance - ownerBalanceAfter).toString(), (accountBalanceAfter - accountBalance).toString());
        collectedCounter += 1;
    }

    async function chargeForStreams(users, streamsCount) {
        await fractionalizedNFT.chargeForStreams(users, streamsCount, {from: owner});
    }

    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min;
    }

    it("stress test: high volume of listings and purchases", async () => {
        for (let i = 0; i < 500; i++) {
            let actor = accounts[getRandomInt(1, accounts.length)];
            let action = getRandomInt(0, 5);
            if (action == 0) {
                let amount = getRandomInt(1, maxTokensAmount)
                let price = getRandomInt(1, 500);
                await listItemPipe(actor, nftNames[getRandomInt(0, nftNames.length)], amount, price);
            } else if (action == 1) {
                if (listedItems.size == 0) {
                    continue;
                }
                const keysArray = [...listedItems.keys()];       
                let itemId = keysArray[getRandomInt(0, keysArray.length)]
                await purchaseItemPipe(actor, itemId);
            } else if (action == 2) {
                console.log(listedItems);
                if (listedItems.size == 0) {
                    continue;
                }
                const itemsKeys = [...listedItems.keys()];  
                const itemId = itemsKeys[getRandomInt(0, itemsKeys.length)];
                let item = await marketplace.getItem(itemId)
                await updateItemPrice(item.tokenId, item.seller, itemId, getRandomInt(1, 500));
            } else if (action == 3) {
                if (listedItems.size == 0) {
                    continue;
                }
                const itemsKeys = [...listedItems.keys()];  
                const itemId = itemsKeys[getRandomInt(0, itemsKeys.length)];
                let item = await marketplace.getItem(itemId)
                await delistItem(item.seller, itemId);
            } else if (action == 4) {
                let numberOfNfts = getRandomInt(0, 10);
                let nfts = []
                for (let i = 0; i < numberOfNfts; i++) {
                    nfts.push(nftNames[getRandomInt(0, nftNames.length)]);
                }
                await collectNFTsIncome(actor, nfts);
            }
            console.log("Iteration:")
            console.log(i);
            console.log("Listed:");
            console.log(listedCounter);
            console.log("Purchased:");
            console.log(purchasedCounter);
            console.log("Delisted:");
            console.log(delistedCounter);
            console.log("Updated:");
            console.log(updatedCounter);
            console.log("Collected:")
            console.log(collectedCounter);
        }
    });
});
