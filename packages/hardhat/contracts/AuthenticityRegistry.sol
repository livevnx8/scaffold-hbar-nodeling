// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * AuthenticityRegistry — on-chain anchor for Hashinal authenticity receipts.
 *
 * Off-chain verification produces a tamper-evident receipt (taskHash / decisionHash).
 * This registry stores the decisionHash per claimId and optional collection pointers
 * (e.g. HTS token id / allowlist snapshot hash as bytes32) so third parties can
 * confirm a presented receipt matches what was anchored on Hedera.
 *
 * Access: only the operator may write. Reads stay public.
 */
contract AuthenticityRegistry {
    struct Anchor {
        bytes32 decisionHash;
        uint64 anchoredAt;
        address anchoredBy;
    }

    struct CollectionPointer {
        bytes32 allowlistSnapshotHash;
        string tokenId;
        uint64 updatedAt;
    }

    mapping(string => Anchor) private _anchors;
    mapping(string => CollectionPointer) private _collections;

    address public operator;

    event ReceiptAnchored(
        string indexed claimId,
        bytes32 indexed decisionHash,
        address indexed anchoredBy
    );
    event CollectionPointerSet(
        string indexed collectionId,
        bytes32 allowlistSnapshotHash,
        string tokenId
    );
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);

    constructor() {
        operator = msg.sender;
        emit OperatorTransferred(address(0), msg.sender);
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    function transferOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "zero operator");
        emit OperatorTransferred(operator, newOperator);
        operator = newOperator;
    }

    function anchorReceipt(string calldata claimId, bytes32 decisionHash) external onlyOperator {
        require(bytes(claimId).length > 0, "empty claimId");
        require(decisionHash != bytes32(0), "empty decisionHash");
        require(_anchors[claimId].anchoredAt == 0, "already anchored");
        _anchors[claimId] = Anchor(decisionHash, uint64(block.timestamp), msg.sender);
        emit ReceiptAnchored(claimId, decisionHash, msg.sender);
    }

    function setCollectionPointer(
        string calldata collectionId,
        bytes32 allowlistSnapshotHash,
        string calldata tokenId
    ) external onlyOperator {
        require(bytes(collectionId).length > 0, "empty collectionId");
        _collections[collectionId] = CollectionPointer(
            allowlistSnapshotHash,
            tokenId,
            uint64(block.timestamp)
        );
        emit CollectionPointerSet(collectionId, allowlistSnapshotHash, tokenId);
    }

    function getAnchor(
        string calldata claimId
    ) external view returns (bytes32 decisionHash, uint64 anchoredAt, address anchoredBy) {
        Anchor memory a = _anchors[claimId];
        require(a.anchoredAt != 0, "unknown claim");
        return (a.decisionHash, a.anchoredAt, a.anchoredBy);
    }

    function getCollectionPointer(
        string calldata collectionId
    )
        external
        view
        returns (bytes32 allowlistSnapshotHash, string memory tokenId, uint64 updatedAt)
    {
        CollectionPointer memory p = _collections[collectionId];
        require(p.updatedAt != 0, "unknown collection");
        return (p.allowlistSnapshotHash, p.tokenId, p.updatedAt);
    }

    function verifyReceipt(string calldata claimId, bytes32 decisionHash) external view returns (bool) {
        return _anchors[claimId].decisionHash == decisionHash && _anchors[claimId].anchoredAt != 0;
    }
}
