const FractionalizedNFT = artifacts.require("FractionalizedNFT");
const MockStableCoin = artifacts.require("MockStableCoin");
const Marketplace = artifacts.require("Marketplace");

module.exports = async function(deployer, network, accounts) {
  await deployer.deploy(MockStableCoin);
  const mockStableCoin = await MockStableCoin.deployed();
  // let stableAddress = "0x575071e11F856f3D0583b4a5775DED6F34c413e9";
  let stableAddress = mockStableCoin.address;
  await deployer.deploy(FractionalizedNFT, stableAddress, 1000, 1000);
  const fractionalizedNFT = await FractionalizedNFT.deployed();
  // let fractionalizedAddress = "0xc2940C2655126306D7dc55CAA0434B1E9BbFD634";
  let fractionalizedAddress = fractionalizedNFT.address;
  await deployer.deploy(Marketplace, stableAddress, fractionalizedAddress, 30);
};
