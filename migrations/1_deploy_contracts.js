const FractionalizedNFT = artifacts.require("FractionalizedNFT");
const MockStableCoin = artifacts.require("MockStableCoin");
const Marketplace = artifacts.require("Marketplace");

module.exports = async function(deployer, network, accounts) {
  await deployer.deploy(MockStableCoin);
  const mockStableCoin = await MockStableCoin.deployed();

  await deployer.deploy(FractionalizedNFT, mockStableCoin.address, 1000, 1000);
  const fractionalizedNFT = await FractionalizedNFT.deployed();
  await deployer.deploy(Marketplace, mockStableCoin.address, fractionalizedNFT.address);
};
