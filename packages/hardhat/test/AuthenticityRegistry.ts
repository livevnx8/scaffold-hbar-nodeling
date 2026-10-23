import { expect } from "chai";
import { ethers } from "hardhat";

describe("AuthenticityRegistry", function () {
  const claimId = "claim-tiny-001";
  const decisionHash = ethers.keccak256(ethers.toUtf8Bytes("fixture-decision"));
  const snapshotHash = ethers.keccak256(ethers.toUtf8Bytes("snapshot"));

  async function deploy() {
    const Registry = await ethers.getContractFactory("AuthenticityRegistry");
    const registry = await Registry.deploy();
    return { registry };
  }

  it("anchors a receipt and reads it back", async function () {
    const { registry } = await deploy();
    const [deployer] = await ethers.getSigners();
    await expect(registry.anchorReceipt(claimId, decisionHash))
      .to.emit(registry, "ReceiptAnchored")
      .withArgs(claimId, decisionHash, await deployer.getAddress());

    const [hash, anchoredAt, anchoredBy] = await registry.getAnchor(claimId);
    expect(hash).to.equal(decisionHash);
    expect(anchoredAt).to.be.greaterThan(0);
    expect(anchoredBy).to.equal(await deployer.getAddress());
  });

  it("verifies a presented receipt hash", async function () {
    const { registry } = await deploy();
    await registry.anchorReceipt(claimId, decisionHash);
    expect(await registry.verifyReceipt(claimId, decisionHash)).to.equal(true);
    expect(
      await registry.verifyReceipt(claimId, ethers.keccak256(ethers.toUtf8Bytes("other"))),
    ).to.equal(false);
  });

  it("rejects double anchoring", async function () {
    const { registry } = await deploy();
    await registry.anchorReceipt(claimId, decisionHash);
    await expect(registry.anchorReceipt(claimId, decisionHash)).to.be.revertedWith(
      "already anchored",
    );
  });

  it("stores collection pointers", async function () {
    const { registry } = await deploy();
    await expect(registry.setCollectionPointer("tinies-genesis", snapshotHash, "0.0.12345"))
      .to.emit(registry, "CollectionPointerSet")
      .withArgs("tinies-genesis", snapshotHash, "0.0.12345");
    const [snap, tokenId, updatedAt] = await registry.getCollectionPointer("tinies-genesis");
    expect(snap).to.equal(snapshotHash);
    expect(tokenId).to.equal("0.0.12345");
    expect(updatedAt).to.be.greaterThan(0);
  });

  it("reverts unknown lookups and empty inputs", async function () {
    const { registry } = await deploy();
    await expect(registry.getAnchor("nope")).to.be.revertedWith("unknown claim");
    await expect(registry.getCollectionPointer("nope")).to.be.revertedWith("unknown collection");
    await expect(registry.anchorReceipt("", decisionHash)).to.be.revertedWith("empty claimId");
    await expect(
      registry.anchorReceipt(
        claimId,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ),
    ).to.be.revertedWith("empty decisionHash");
  });

  it("operator gate: stranger cannot anchor; rotation works", async function () {
    const { registry } = await deploy();
    const [deployer, next, stranger] = await ethers.getSigners();
    await expect(
      registry.connect(stranger).anchorReceipt(claimId, decisionHash),
    ).to.be.revertedWith("not operator");

    await expect(registry.transferOperator(await next.getAddress()))
      .to.emit(registry, "OperatorTransferred")
      .withArgs(await deployer.getAddress(), await next.getAddress());

    await expect(registry.anchorReceipt(claimId, decisionHash)).to.be.revertedWith("not operator");
    await registry.connect(next).anchorReceipt(claimId, decisionHash);
    expect(await registry.verifyReceipt(claimId, decisionHash)).to.equal(true);
  });
});
