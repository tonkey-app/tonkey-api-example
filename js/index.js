const TonWeb = window.TonWeb;

const BASE_URL = 'https://graphql.tonkey.app/graphql';

class Tonkey {
  constructor(baseUrl, provider) {
    this.baseUrl = baseUrl;
    this.provider = provider;

    this.walletAddress = undefined;
    this.safeInfo = undefined;

    this.ownerIndex = undefined;
    this.tx = undefined;
  }

  static toRawAddress(address) {
    return new TonWeb.Address(address).toString(false);
  }

  static async query(baseUrl, queryString, variables) {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: queryString,
        variables: variables,
      }),
    });

    if (response.status === 200) {
      const result = await response.json();
      if (result.error) {
        console.log(result.error);
        throw new Error('GraphQL API Failed');
      }
      return result;
    }

    return null;
  }

  async connect() {
    const accounts = await this.provider.send('ton_requestAccounts');
    this.walletAddress = accounts[0];
    document.getElementById('walletAddress').innerText = this.walletAddress;
    document.getElementById('connectArea').style = '';
    document.getElementById('userAddr').value = this.walletAddress;
  }

  async getSafe() {
    const chainId = document.getElementById('chainId').value;
    const safeAddress = document.getElementById('safeAddress').value;

    const queryString = `query Safe($chainId: String!, $safeAddress: String!) {
      safe(chainId: $chainId, safeAddress: $safeAddress) {
        owners {
          address
          publicKey
        }
      }
    }`;
    const variables = {
      chainId: chainId,
      safeAddress: Tonkey.toRawAddress(safeAddress),
    };
    const result = await Tonkey.query(this.baseUrl, queryString, variables);

    if (result.data.safe) {
      this.safeInfo = result.data;
    }
  }

  async isOwner() {
    await this.getSafe();

    const userAddress = document.getElementById('userAddr').value;
    const rawUserAddress = Tonkey.toRawAddress(userAddress);

    const output = window.document.querySelector('#isOwner');
    if (this.safeInfo.safe) {
      const owners = this.safeInfo.safe.owners;
      const ownerIndex = owners
        .map((e) => {
          return e.address;
        })
        .indexOf(rawUserAddress);

      if (ownerIndex !== -1) {
        this.ownerIndex = ownerIndex;
        output.innerText = 'is Owner';
      } else {
        output.innerText = 'is not Owner';
      }
    } else {
      output.innerText = 'no safe found';
    }
  }

  async getTransactionStatus() {
    const chainId = document.getElementById('chainId').value;
    const safeAddress = document.getElementById('safeAddress').value;
    const queryId = document.getElementById('queryId').innerText;

    let status = `Transaction with queryId ${queryId} not found`;

    const transactionQueue = await this._getTransactionQueue(
      chainId,
      safeAddress
    );
    const q = transactionQueue.find(
      (tx) => tx.summary.multiSigExecutionInfo?.queryId === queryId
    );
    if (q) status = q.summary.status;

    const transactionHistory = await this._getTransactionHistory(
      chainId,
      safeAddress
    );
    const h = transactionHistory.find(
      (tx) => tx.summary.multiSigExecutionInfo?.queryId === queryId
    );
    if (h) status = h.summary.status;

    const output = window.document.querySelector('#txStatus');
    output.innerText = status;
  }

  async _getTransactionHistory(chainId, safeAddress) {
    const queryString = `query TransactionHistory($chainId: String!, $safeAddress: String!) {
      transactionHistory(chainId: $chainId, safeAddress: $safeAddress) {
        details {
          from
          to
          value
          dataHex
          hash
          executedAt
          fee
          exitCode
        }
        summary {
          createdAt
          multiSigExecutionInfo {
            orderCellBoc
            queryId
            expiredAt
            confirmationsRequired
            confirmationsSubmitted
            confirmations
            executor
            remark
          }
          status
          transactionInfo {
            ... on Transfer {
              transactionType
              sender
              recipient
              direction
              transferInfo {
                ... on NativeTransferInfo {
                  transferType
                  value
                }
                ... on FTTransferInfo {
                  transferType
                  tokenAddress
                  tokenName
                  tokenSymbol
                  logoUri
                  decimals
                  value
                }
                ... on NFTTransferInfo {
                  transferType
                  tokenAddress
                  tokenName
                  tokenSymbol
                  logoUri
                  tokenId
                }
              }
            }
            ... on Creation {
              transactionType
              creator
            }
            ... on Cancellation {
              transactionType
              isCancellation
            }
          }
        }
      }
    }`;

    const variables = {
      chainId: chainId,
      safeAddress: Tonkey.toRawAddress(safeAddress),
    };

    const result = await Tonkey.query(this.baseUrl, queryString, variables);

    return result.data.transactionHistory;
  }

  async getTransactionHistory() {
    const chainId = document.getElementById('chainId').value;
    const safeAddress = document.getElementById('safeAddress').value;

    const transactionHistory = await this._getTransactionHistory(
      chainId,
      safeAddress
    );

    if (transactionHistory.length > 0) {
      const output = window.document.querySelector('#transactionHistoryResult');
      output.innerText = JSON.stringify(transactionHistory, undefined, 2);
    }
  }

  async _getTransactionQueue(chainId, safeAddress) {
    const queryString = `query TransactionQueue($chainId: String!, $safeAddress: String!) {
      transactionQueue(chainId: $chainId, safeAddress: $safeAddress) {
        details {
          from
          to
          value
          dataHex
          hash
          executedAt
          fee
          exitCode
        }
        summary {
          createdAt
          status
          transactionInfo {
            ... on Transfer {
              transactionType
              sender
              recipient
              direction
              transferInfo {
                ... on NativeTransferInfo {
                  transferType
                  value
                }
                ... on FTTransferInfo {
                  transferType
                  tokenAddress
                  tokenName
                  tokenSymbol
                  logoUri
                  decimals
                  value
                }
                ... on NFTTransferInfo {
                  transferType
                  tokenAddress
                  tokenName
                  tokenSymbol
                  logoUri
                  tokenId
                }
              }
            }
            ... on Creation {
              transactionType
              creator
            }
            ... on Cancellation {
              transactionType
              isCancellation
            }
          }
          multiSigExecutionInfo {
            orderCellBoc
            queryId
            expiredAt
            confirmationsRequired
            confirmationsSubmitted
            confirmations
            executor
            remark
          }
        }
      }
    }`;

    const variables = {
      chainId: chainId,
      safeAddress: Tonkey.toRawAddress(safeAddress),
    };

    const result = await Tonkey.query(this.baseUrl, queryString, variables);

    return result.data.transactionQueue;
  }

  async getTransactionQueue() {
    const chainId = document.getElementById('chainId').value;
    const safeAddress = document.getElementById('safeAddress').value;

    const transactionQueue = await this._getTransactionQueue(
      chainId,
      safeAddress
    );

    if (transactionQueue.length > 0) {
      const output = window.document.querySelector('#transactionQueueResult');
      output.innerText = JSON.stringify(transactionQueue, undefined, 2);
    }
  }

  async getBalance() {
    const chainId = document.getElementById('chainId').value;
    const safeAddress = document.getElementById('safeAddress').value;

    const queryString = `query Balance($chainId: String!, $safeAddress: String!) {
      balance(chainId: $chainId, safeAddress: $safeAddress) {
        fiatTotal
    }}`;
    const variables = {
      chainId: chainId,
      safeAddress: Tonkey.toRawAddress(safeAddress),
    };
    const result = await Tonkey.query(this.baseUrl, queryString, variables);

    const balance = result.data.balance.fiatTotal;
    const output = window.document.querySelector('#balance');
    output.innerText = 'balance: ' + balance + ' USD';
  }

  async genPayload() {
    const chainId = document.getElementById('chainId').value;
    const safeAddress = document.getElementById('safeAddress').value;

    const recipient = document.getElementById('recipient').value;
    const amount = document.getElementById('amount').value;
    const remark = document.getElementById('remark').value;

    if (!recipient | !amount) {
      window.alert('please fill all fields');
      return;
    }

    const nanoAmount = window.TonWeb.utils.toNano(amount).toString();

    const queryString = `query TonTransfer($recipient: String!, $amount: String!, $safeAddress: String!, $chainId: String!, $remark: String) {
      tonTransfer(recipient: $recipient, amount: $amount, safeAddress: $safeAddress, chainId: $chainId, remark: $remark) {
        chainId
        multiSigExecutionInfo {
          confirmations
          confirmationsRequired
          confirmationsSubmitted
          executor
          expiredAt
          orderCellBoc
          queryId
          safeAddress
        }
        safeAddress
        transfer {
          direction
          recipient
          sender
          transferInfo {
            native {
              transferType
              value
            }
          }
        }
      }
    }`;
    const variables = {
      chainId: chainId,
      safeAddress: Tonkey.toRawAddress(safeAddress),
      recipient: recipient,
      amount: nanoAmount,
      remark: remark,
    };

    const result = await Tonkey.query(this.baseUrl, queryString, variables);
    if (result.data.tonTransfer) {
      const orderCellBoc =
        result.data.tonTransfer.multiSigExecutionInfo.orderCellBoc;
      this.tx = result.data.tonTransfer;
      const output = window.document.querySelector('#output');
      output.innerText = 'get payload successfully';
      window.document.getElementById('orderCellBoc').value = orderCellBoc;
    }
  }

  async sign() {
    const remark = document.getElementById('remark').value;
    const orderCellBoc = document.getElementById('orderCellBoc').value;

    const [cell] = TonWeb.boc.Cell.fromBoc(orderCellBoc);
    const orderHash = TonWeb.utils.bytesToHex(await cell.hash());
    const signature = await this.provider.send('ton_rawSign', {
      data: orderHash,
    });

    const output = window.document.querySelector('#output1');
    output.innerText = 'signature: ' + signature;

    if (this.ownerIndex === undefined) {
      await this.isOwner();
    }

    this.tx.multiSigExecutionInfo.confirmations[this.ownerIndex] = signature;
    this.tx.multiSigExecutionInfo.remark = remark;
    delete this.tx.multiSigExecutionInfo.safeAddress;

    console.log(this.tx);
  }

  async create() {
    const queryString = `mutation CreateTransfer($content: createTransferReq!) {
      createTransfer(content: $content) {
        error {
          code
          detail
          extra
        }
        success
      }
    }`;
    console.log(this.tx);
    const variables = {
      content: this.tx,
    };
    const result = await Tonkey.query(this.baseUrl, queryString, variables);

    if (result.data.createTransfer.success) {
      const queryId = this.tx.multiSigExecutionInfo.queryId;
      window.document.getElementById('queryId').innerText = queryId;
    }
  }
}

const _ = setInterval(() => {
  if (window.TonWeb) {
    if (!window.tonkey) {
      window.tonkey = new Tonkey(BASE_URL, window.openmask.provider);
      clearInterval(_);
    }
  }
}, 500);
