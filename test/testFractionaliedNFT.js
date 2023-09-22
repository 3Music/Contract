const FractionalizedNFT = artifacts.require("FractionalizedNFT");
const MockStableCoin = artifacts.require("MockStableCoin");

contract("FractionalizedNFT", (accounts) => {
    let fractionalizedNFT;
    let mockStableCoin;
    const owner = accounts[0];
    const user1 = accounts[1];
    const user2 = accounts[2];

    beforeEach(async () => {
        mockStableCoin = await MockStableCoin.new({ from: owner });
        fractionalizedNFT = await FractionalizedNFT.new(mockStableCoin.address, 1000, 1000, { from: owner });
        await mockStableCoin.mint(owner, 1000000000);
        await mockStableCoin.approve(fractionalizedNFT.address, 1000000000, {from: owner});
    });

    it("should correctly set the owner", async () => {
        const contractAddress = await fractionalizedNFT.getOwner();
        assert.equal(contractAddress, owner, "Owner is not set correctly");
    });

    it("should allow minting of tokens", async () => {
        let mintAmount = 500;
        await fractionalizedNFT.setMaxSupply("testNFT", 1000, {from: owner})
        await fractionalizedNFT.mint("testNFT", mintAmount, { from: owner });
        const totalSupply = await fractionalizedNFT.totalSupply("testNFT");
        assert.equal(totalSupply.toString(), "500");
        const ownerBalance = await fractionalizedNFT.balanceOf("testNFT", owner);
        assert.equal(mintAmount.toString(), ownerBalance.toString());
    });

    it("shouldn't mint more than max supply", async () => {
        let mintAmount = 500;
        await fractionalizedNFT.setMaxSupply("testNFT", 1000, {from: owner})
        await fractionalizedNFT.mint("testNFT", mintAmount, { from: owner });
        let totalSupply = await fractionalizedNFT.totalSupply("testNFT");
        assert.equal(totalSupply.toString(), "500");
        let ownerBalance = await fractionalizedNFT.balanceOf("testNFT", owner);
        assert.equal(mintAmount.toString(), ownerBalance.toString());
        await fractionalizedNFT.mint("testNFT", mintAmount, {from: owner});
        totalSupply = await fractionalizedNFT.totalSupply("testNFT");
        assert.equal(totalSupply.toString(), "1000");
        ownerBalance = await fractionalizedNFT.balanceOf("testNFT", owner);
        assert.equal((mintAmount * 2).toString(), ownerBalance.toString());
        try {
            await fractionalizedNFT.mint("testNFT", 1, {from: owner});
            assert.fail("Cannot mint more than max supply");
        } catch (error) {
            const revertFound = error.message.search('revert') >= 0;
            assert(revertFound, `Expected "revert", got ${error} instead`);
        }
    });

    it("transfer basic", async () => {
        let mintAmount = 200;
        await fractionalizedNFT.setMaxSupply("testNFT", 1000, {from: owner});
        await fractionalizedNFT.mint("testNFT", 2 * mintAmount, {from: owner});
        await fractionalizedNFT.transfer("testNFT", user1, mintAmount, { from: owner });
        await fractionalizedNFT.transfer("testNFT", user2, mintAmount, { from: owner });
        let totalSupply = await fractionalizedNFT.totalSupply("testNFT");
        assert.equal(totalSupply.toString(), "400");

        await fractionalizedNFT.transfer("testNFT", user2, 100, {from: user1});
        let user1Balance = await fractionalizedNFT.balanceOf("testNFT", user1);
        let user2Balance = await fractionalizedNFT.balanceOf("testNFT", user2);
        assert.equal("100", user1Balance.toString());
        assert.equal("300", user2Balance.toString());
    });

    it("can't transfer more than balance", async () => {
        let mintAmount = 200;
        await fractionalizedNFT.setMaxSupply("testNFT", 1000, {from: owner});
        await fractionalizedNFT.mint("testNFT", mintAmount, {from: owner});
        await fractionalizedNFT.transfer("testNFT", user1, mintAmount, { from: owner });

        try {
            await fractionalizedNFT.transfer("testNFT", user2, mintAmount + 1, {from: user1})
            assert.fail("Transfer more than balance");
        } catch (error) {
            const revertFound = error.message.search('revert') >= 0;
            assert(revertFound, `Expected "revert", got ${error} instead`);
        }
    });

    it("approve increase allowance", async () => {
        await fractionalizedNFT.approve("testNFT", user2, 500, {from: user1});
        let allowance = await fractionalizedNFT.allowance("testNFT", user1, user2);
        assert.equal("500", allowance.toString());
    });

    it("consequent approves", async () => {
        await fractionalizedNFT.approve("testNFT", user2, 500, {from: user1});
        let allowance = await fractionalizedNFT.allowance("testNFT", user1, user2);
        assert.equal("500", allowance.toString());
        await fractionalizedNFT.approve("testNFT", user2, 600, {from: user1});
        allowance = await fractionalizedNFT.allowance("testNFT", user1, user2);
        assert.equal("600", allowance.toString());
        await fractionalizedNFT.approve("testNFT", user2, 400, {from: user1});
        allowance = await fractionalizedNFT.allowance("testNFT", user1, user2);
        assert.equal("400", allowance.toString());
    });

    it("transferFrom", async () => {
        let mintAmount = 500;
        await fractionalizedNFT.approve("testNFT", user2, 500, {from: user1});
        let allowance = await fractionalizedNFT.allowance("testNFT", user1, user2);
        assert.equal("500", allowance.toString());
        await fractionalizedNFT.setMaxSupply("testNFT", 1000, {from: owner});
        await fractionalizedNFT.mint("testNFT", mintAmount, { from: owner });
        await fractionalizedNFT.transfer("testNFT", user1, mintAmount);
        await fractionalizedNFT.transferFrom("testNFT", user1, owner, 300, {from: user2});
        let ownerBalance = await fractionalizedNFT.balanceOf("testNFT", owner);
        assert.equal(ownerBalance.toString(), "300");
        try {
            await fractionalizedNFT.transferFrom("testNFT", user1, owner, 300, {from: user2});
            assert.fail("TransferFrom more than balance");
        } catch (error) {
            const revertFound = error.message.search('revert') >= 0;
            assert(revertFound, `Expected "revert", got ${error} instead`);
        }
        await fractionalizedNFT.transferFrom("testNFT", user1, owner, 200, {from: user2});
        ownerBalance = await fractionalizedNFT.balanceOf("testNFT", owner);
        assert.equal(ownerBalance.toString(), "500");
    });

    it("nft payouts", async () => {
        let mintAmount = 500;
        await fractionalizedNFT.setStreams(["testNFT"], [1000]);
        await fractionalizedNFT.setMaxSupply("testNFT", 1000, {from: owner});
        await fractionalizedNFT.mint("testNFT", mintAmount, {from: owner});
        await fractionalizedNFT.transfer("testNFT", user1, mintAmount, {from: owner});
        await fractionalizedNFT.setStreams(["testNFT"], [2000]);
        let result = await fractionalizedNFT.collectNFTsIncome(["testNFT"], {from: user1});        
        const log = result.logs[0];
        const totalPayout = log.args.totalPayout;
        assert.equal(totalPayout.toString(), "500000");
    });

    it("consequent payouts", async () => {
        let mintAmount = 500;
        await fractionalizedNFT.setStreams(["testNFT"], [1000]);
        await fractionalizedNFT.setMaxSupply("testNFT", 1000, {from: owner});
        await fractionalizedNFT.mint("testNFT", mintAmount, {from: owner});
        await fractionalizedNFT.transfer("testNFT", user1, mintAmount, {from: owner});
        await fractionalizedNFT.setStreams(["testNFT"], [2000]);
        let result = await fractionalizedNFT.collectNFTsIncome(["testNFT"], {from: user1});        
        let log = result.logs[0];
        let totalPayout = log.args.totalPayout;
        assert.equal(totalPayout.toString(), "500000");
        await fractionalizedNFT.setStreams(["testNFT"], [4000]);
        result = await fractionalizedNFT.collectNFTsIncome(["testNFT"], {from: user1});        
        log = result.logs[0];
        totalPayout = log.args.totalPayout;
        assert.equal(totalPayout.toString(), "1000000");
        let user1StableBalance = await mockStableCoin.balanceOf(user1);
        assert.equal(user1StableBalance.toString(), "1500000");
    });

    it("payouts after transfer", async () => {
        let mintAmount = 500;
        await fractionalizedNFT.setStreams(["testNFT"], [1000]);
        await fractionalizedNFT.setMaxSupply("testNFT", 1000, {from: owner});
        await fractionalizedNFT.mint("testNFT", mintAmount, {from: owner});
        await fractionalizedNFT.transfer("testNFT", user1, mintAmount, {from: owner});
        let user1StableBalanceBefore = await mockStableCoin.balanceOf(user1);
        let user2StableBalanceBefore = await mockStableCoin.balanceOf(user1);
        await fractionalizedNFT.setStreams(["testNFT"], [2000]);
        await fractionalizedNFT.transfer("testNFT", user2, 250, {from: user1});
        let user1StableBalanceAfter = await mockStableCoin.balanceOf(user1);
        assert.equal((user1StableBalanceAfter - user1StableBalanceBefore).toString(), "500000");
        await fractionalizedNFT.setStreams(["testNFT"], [3000]);
        await fractionalizedNFT.setNFTStreamCost(2000, {from: owner});
        await fractionalizedNFT.collectNFTsIncome(["testNFT"], {from: user1});        
        await fractionalizedNFT.collectNFTsIncome(["testNFT"], {from: user2});        
        let user1StableBalance = await mockStableCoin.balanceOf(user1);
        let user2StableBalance = await mockStableCoin.balanceOf(user2);
        assert.equal((user1StableBalance - user1StableBalanceAfter).toString(), "250000");
        assert.equal((user2StableBalance - user2StableBalanceBefore).toString(), "250000");
    });

    it("charge for streams", async () => {
        await fractionalizedNFT.setStreams(["testNFT"], [1000]);
        let ownerStalbeBalance = await mockStableCoin.balanceOf(owner);
        await mockStableCoin.transfer(user1, 1000000, {from: owner});
        await mockStableCoin.approve(fractionalizedNFT.address, 1000000, {from: user1});
        let user1StableBalance = await mockStableCoin.balanceOf(user1);        
        await fractionalizedNFT.chargeForStreams([user1], [1000], {from: owner});
        let chargedStreams = await fractionalizedNFT.chargedStreams();
        let user1StableBalanceAfter = await mockStableCoin.balanceOf(user1);
        let ownerStableBalanceAfter = await mockStableCoin.balanceOf(owner);
        assert.equal((user1StableBalance - user1StableBalanceAfter).toString(), "1000000");
        assert.equal(ownerStableBalanceAfter.toString(), ownerStalbeBalance.toString());
        assert.equal(chargedStreams.toString(), "1000");
    });

    it("edge cases", async () => {
        try {
            await fractionalizedNFT.mint("testNFT", 0, {from: owner});
            assert.fail("Transfer more than balance");
        } catch (error) {
            const revertFound = error.message.search('revert') >= 0;
            assert(revertFound, `Expected "revert", got ${error} instead`);
        }
    });

});

