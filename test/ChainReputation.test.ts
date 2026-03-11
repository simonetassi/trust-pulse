import { expect } from "chai";
import { ethers } from "hardhat";
import { ChainReputation } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ChainReputation", function () {
  let contract: ChainReputation;
  let oracle: SignerWithAddress;
  let operator: SignerWithAddress;

  beforeEach(async function () {
    [oracle, operator] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ChainReputation");
    contract = await Factory.deploy(oracle.address) as ChainReputation;
  });

  it("should deploy with the correct oracle address", async function () {
    expect(await contract.oracle()).to.equal(oracle.address);
  });
});