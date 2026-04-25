/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/slp.json`.
 */
export type Slp = {
  "address": "5uTb4ZPTVB1HFMdTeBXELPzgaX2dcVRZoxPQW2SNzQAH",
  "metadata": {
    "name": "slp",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Skill Loops Protocol"
  },
  "instructions": [
    {
      "name": "claimRevenue",
      "discriminator": [
        4,
        22,
        151,
        70,
        183,
        79,
        73,
        189
      ],
      "accounts": [
        {
          "name": "holder",
          "writable": true,
          "signer": true,
          "relations": [
            "claimable"
          ]
        },
        {
          "name": "skill",
          "relations": [
            "pool",
            "claimable"
          ]
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              }
            ]
          }
        },
        {
          "name": "claimable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  108,
                  97,
                  105,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              },
              {
                "kind": "account",
                "path": "holder"
              },
              {
                "kind": "account",
                "path": "claimable.snapshot_id",
                "account": "claimableRevenue"
              }
            ]
          }
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "evaluateExperience",
      "discriminator": [
        116,
        16,
        51,
        210,
        156,
        7,
        237,
        55
      ],
      "accounts": [
        {
          "name": "judge",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "skill",
          "relations": [
            "experience",
            "ledger"
          ]
        },
        {
          "name": "experience",
          "writable": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              }
            ]
          }
        },
        {
          "name": "contributorShare",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              },
              {
                "kind": "account",
                "path": "experience.contributor",
                "account": "experienceRecord"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "score",
          "type": "u8"
        },
        {
          "name": "judgeReportTxId",
          "type": "string"
        }
      ]
    },
    {
      "name": "initializeProtocol",
      "discriminator": [
        188,
        233,
        252,
        106,
        134,
        146,
        202,
        91
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "judge",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "publishNewVersion",
      "discriminator": [
        130,
        91,
        146,
        229,
        133,
        180,
        238,
        199
      ],
      "accounts": [
        {
          "name": "author",
          "writable": true,
          "signer": true,
          "relations": [
            "skill"
          ]
        },
        {
          "name": "skill",
          "writable": true
        },
        {
          "name": "newVersion",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "publishNewVersionArgs"
            }
          }
        }
      ]
    },
    {
      "name": "publishSkill",
      "discriminator": [
        40,
        197,
        180,
        144,
        24,
        187,
        170,
        130
      ],
      "accounts": [
        {
          "name": "author",
          "writable": true,
          "signer": true
        },
        {
          "name": "skill",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  107,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "author"
              },
              {
                "kind": "arg",
                "path": "args.name_hash"
              }
            ]
          }
        },
        {
          "name": "version",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              },
              {
                "kind": "const",
                "value": [
                  1,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              }
            ]
          }
        },
        {
          "name": "authorShare",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              },
              {
                "kind": "account",
                "path": "author"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "publishSkillArgs"
            }
          }
        }
      ]
    },
    {
      "name": "settlePeriod",
      "discriminator": [
        115,
        57,
        95,
        16,
        21,
        107,
        129,
        130
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "skill",
          "relations": [
            "pool",
            "ledger"
          ]
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              }
            ]
          }
        },
        {
          "name": "ledger",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "submitExperience",
      "discriminator": [
        125,
        139,
        27,
        118,
        164,
        246,
        219,
        139
      ],
      "accounts": [
        {
          "name": "contributor",
          "writable": true,
          "signer": true
        },
        {
          "name": "skill",
          "writable": true
        },
        {
          "name": "experience",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              },
              {
                "kind": "account",
                "path": "skill.next_experience_id",
                "account": "skill"
              }
            ]
          }
        },
        {
          "name": "contributorShare",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              },
              {
                "kind": "account",
                "path": "contributor"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "submitExperienceArgs"
            }
          }
        }
      ]
    },
    {
      "name": "subscribe",
      "discriminator": [
        254,
        28,
        191,
        138,
        156,
        179,
        183,
        53
      ],
      "accounts": [
        {
          "name": "subscriber",
          "writable": true,
          "signer": true
        },
        {
          "name": "skill",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              }
            ]
          }
        },
        {
          "name": "subscription",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              },
              {
                "kind": "account",
                "path": "subscriber"
              }
            ]
          }
        },
        {
          "name": "shareAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "skill"
              },
              {
                "kind": "account",
                "path": "subscriber"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "claimableRevenue",
      "discriminator": [
        89,
        123,
        246,
        130,
        194,
        189,
        209,
        3
      ]
    },
    {
      "name": "experienceRecord",
      "discriminator": [
        182,
        105,
        65,
        175,
        65,
        142,
        108,
        154
      ]
    },
    {
      "name": "protocolConfig",
      "discriminator": [
        207,
        91,
        250,
        28,
        152,
        179,
        215,
        209
      ]
    },
    {
      "name": "revenuePool",
      "discriminator": [
        207,
        111,
        81,
        33,
        143,
        210,
        93,
        113
      ]
    },
    {
      "name": "shareAccount",
      "discriminator": [
        244,
        129,
        214,
        179,
        30,
        194,
        247,
        141
      ]
    },
    {
      "name": "shareLedger",
      "discriminator": [
        194,
        86,
        226,
        29,
        94,
        43,
        247,
        123
      ]
    },
    {
      "name": "skill",
      "discriminator": [
        53,
        13,
        242,
        204,
        77,
        249,
        1,
        215
      ]
    },
    {
      "name": "skillVersion",
      "discriminator": [
        92,
        21,
        185,
        243,
        174,
        142,
        222,
        1
      ]
    },
    {
      "name": "subscription",
      "discriminator": [
        64,
        7,
        26,
        135,
        102,
        132,
        98,
        33
      ]
    }
  ],
  "events": [
    {
      "name": "experienceEvaluated",
      "discriminator": [
        234,
        250,
        120,
        37,
        242,
        9,
        208,
        253
      ]
    },
    {
      "name": "experienceSubmitted",
      "discriminator": [
        195,
        91,
        202,
        79,
        225,
        78,
        235,
        80
      ]
    },
    {
      "name": "periodSettled",
      "discriminator": [
        118,
        192,
        157,
        191,
        128,
        119,
        137,
        36
      ]
    },
    {
      "name": "revenueClaimed",
      "discriminator": [
        5,
        254,
        104,
        87,
        133,
        137,
        45,
        116
      ]
    },
    {
      "name": "sharesMinted",
      "discriminator": [
        127,
        139,
        238,
        41,
        118,
        47,
        122,
        39
      ]
    },
    {
      "name": "skillPublished",
      "discriminator": [
        249,
        230,
        13,
        218,
        21,
        168,
        74,
        141
      ]
    },
    {
      "name": "subscribed",
      "discriminator": [
        135,
        59,
        105,
        76,
        190,
        236,
        138,
        228
      ]
    },
    {
      "name": "versionPublished",
      "discriminator": [
        153,
        232,
        67,
        69,
        206,
        21,
        193,
        185
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notJudge",
      "msg": "Caller is not the protocol Judge"
    },
    {
      "code": 6001,
      "name": "alreadyEvaluated",
      "msg": "Experience already evaluated"
    },
    {
      "code": 6002,
      "name": "scoreOutOfRange",
      "msg": "Score must be 0..=50"
    },
    {
      "code": 6003,
      "name": "wrongSkill",
      "msg": "Experience does not belong to this skill"
    },
    {
      "code": 6004,
      "name": "periodNotElapsed",
      "msg": "Settlement period has not elapsed"
    },
    {
      "code": 6005,
      "name": "holdersIncomplete",
      "msg": "Settlement is missing holders"
    },
    {
      "code": 6006,
      "name": "shareAccountMismatch",
      "msg": "ShareAccount belongs to wrong skill"
    },
    {
      "code": 6007,
      "name": "sharesMustBeNonzero",
      "msg": "Zero-share holders may not be settled"
    },
    {
      "code": 6008,
      "name": "wrongClaimPda",
      "msg": "ClaimableRevenue PDA is incorrect"
    },
    {
      "code": 6009,
      "name": "nothingToClaim",
      "msg": "Nothing to claim"
    },
    {
      "code": 6010,
      "name": "zeroPrice",
      "msg": "Subscription price cannot be zero"
    },
    {
      "code": 6011,
      "name": "floorTooLow",
      "msg": "Author ratio floor below protocol minimum"
    },
    {
      "code": 6012,
      "name": "invalidK",
      "msg": "Contribution coefficient out of range"
    },
    {
      "code": 6013,
      "name": "stringTooLong",
      "msg": "String field exceeds maximum length"
    },
    {
      "code": 6014,
      "name": "notAuthor",
      "msg": "Only the skill author can publish new versions"
    },
    {
      "code": 6015,
      "name": "tooManyContributors",
      "msg": "Too many contributing experiences for one version"
    },
    {
      "code": 6016,
      "name": "poolBelowRentExempt",
      "msg": "Claim would leave pool below rent-exempt"
    },
    {
      "code": 6017,
      "name": "settleAccountsUnpaired",
      "msg": "Settle remaining_accounts must be paired (ShareAccount, ClaimableRevenue)"
    }
  ],
  "types": [
    {
      "name": "claimableRevenue",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "holder",
            "type": "pubkey"
          },
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "snapshotId",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "experienceEvaluated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "experienceId",
            "type": "u64"
          },
          {
            "name": "score",
            "type": "u8"
          },
          {
            "name": "sharesMinted",
            "type": "u64"
          },
          {
            "name": "approved",
            "type": "bool"
          },
          {
            "name": "floorHit",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "experienceRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "experienceId",
            "type": "u64"
          },
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "contributor",
            "type": "pubkey"
          },
          {
            "name": "skillVersion",
            "type": "u32"
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "arweaveTxId",
            "type": "string"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "contributionScore",
            "type": "u8"
          },
          {
            "name": "sharesMinted",
            "type": "u64"
          },
          {
            "name": "submittedAt",
            "type": "i64"
          },
          {
            "name": "evaluatedAt",
            "type": "i64"
          },
          {
            "name": "judgeReportTxId",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "experienceSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "experienceId",
            "type": "u64"
          },
          {
            "name": "contributor",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "periodSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "snapshotId",
            "type": "u64"
          },
          {
            "name": "periodRevenue",
            "type": "u64"
          },
          {
            "name": "totalShares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "judge",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "publishNewVersionArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "arweaveTxId",
            "type": "string"
          },
          {
            "name": "contributingExperienceIds",
            "type": {
              "vec": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "publishSkillArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "category",
            "type": "string"
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "arweaveTxId",
            "type": "string"
          },
          {
            "name": "subscriptionPrice",
            "type": "u64"
          },
          {
            "name": "minAuthorRatioBps",
            "type": "u16"
          },
          {
            "name": "k",
            "type": "u16"
          },
          {
            "name": "periodLength",
            "type": "i64"
          },
          {
            "name": "nameHash",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "revenueClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "holder",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "snapshotId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "revenuePool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "currentPeriodRevenue",
            "type": "u64"
          },
          {
            "name": "totalLifetimeRevenue",
            "type": "u64"
          },
          {
            "name": "currentPeriodStart",
            "type": "i64"
          },
          {
            "name": "periodLength",
            "type": "i64"
          },
          {
            "name": "snapshotTotalShares",
            "type": "u64"
          },
          {
            "name": "snapshotId",
            "type": "u64"
          },
          {
            "name": "lastSettlementTime",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "shareAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "holder",
            "type": "pubkey"
          },
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "lockUntil",
            "type": "i64"
          },
          {
            "name": "firstContributionAt",
            "type": "i64"
          },
          {
            "name": "lastContributionAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "shareLedger",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "totalShares",
            "type": "u64"
          },
          {
            "name": "authorShares",
            "type": "u64"
          },
          {
            "name": "minAuthorRatioBps",
            "type": "u16"
          },
          {
            "name": "contributorCount",
            "type": "u32"
          },
          {
            "name": "lastSnapshotTime",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "sharesMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "holder",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "totalSharesAfter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "skill",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "author",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "category",
            "type": "string"
          },
          {
            "name": "currentVersion",
            "type": "u32"
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "arweaveTxId",
            "type": "string"
          },
          {
            "name": "subscriptionPrice",
            "type": "u64"
          },
          {
            "name": "minAuthorRatioBps",
            "type": "u16"
          },
          {
            "name": "k",
            "type": "u16"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "subscriberCount",
            "type": "u32"
          },
          {
            "name": "totalRevenue",
            "type": "u64"
          },
          {
            "name": "nextExperienceId",
            "type": "u64"
          },
          {
            "name": "nameHash",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "skillPublished",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "author",
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "skillVersion",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "version",
            "type": "u32"
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "arweaveTxId",
            "type": "string"
          },
          {
            "name": "contributingExperienceIds",
            "type": {
              "vec": "u64"
            }
          },
          {
            "name": "publishedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "submitExperienceArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "arweaveTxId",
            "type": "string"
          },
          {
            "name": "skillVersion",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "subscribed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "subscriber",
            "type": "pubkey"
          },
          {
            "name": "expiryTime",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "subscription",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subscriber",
            "type": "pubkey"
          },
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "expiryTime",
            "type": "i64"
          },
          {
            "name": "totalCalls",
            "type": "u64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "versionPublished",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skill",
            "type": "pubkey"
          },
          {
            "name": "version",
            "type": "u32"
          },
          {
            "name": "contributingCount",
            "type": "u32"
          }
        ]
      }
    }
  ]
};
