const provider = window.ton;
const Cell = window.TonWeb.boc.Cell;
const Address = window.TonWeb.Address;
const bytesToHex = window.TonWeb.utils.bytesToHex;

const baseUrl = "https://v1-graphql.tonkey.app/graphql";
let chainId = undefined;
let safeAddress = undefined;
let ownerAddress = undefined;
let walletAddress = undefined;
let safeInfo = undefined;
let ownerIndex = undefined;
let recipient = undefined;
let amount = undefined;
let orderCellBoc = undefined;
let res = undefined;
let queryId = undefined;
let stat = undefined;

function toRawAddress(address) {
  return new Address(address).toString(false);
}

async function connect() {
  const accounts = await provider.send("ton_requestAccounts");
  walletAddress = accounts[0];
}
async function getSafe() {
  chainId = document.getElementById("chainId").value;
  safeAddress = document.getElementById("safeAddress").value;
  const rawAddr = toRawAddress(safeAddress);
  const reqVar = {
    chainId: chainId,
    safeAddress: rawAddr,
  };
  try {
    const response = await fetch(`${baseUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query Safe($chainId: String!, $safeAddress: String!) {
          safe(chainId: $chainId, safeAddress: $safeAddress) {
            owners {
              address
              publicKey
            }
          }
        }`,
        variables: reqVar,
      }),
    });
    if (response.status === 200) {
      const result = await response.json();
      if (result.error) {
        console.log(result.error);
        throw new Error("GraphQL API Failed");
      }
      if (result.data.safe === null) console.log("no Data");
      safeInfo = result.data;
    }
  } catch (e) {
    console.log(e);
  }
}

async function validateOwner() {
  userAddress = document.getElementById("userAddr").value;
  await connect();
  await getSafe();
  let output = window.document.querySelector("#isOwner");
  const rawAddr = toRawAddress(userAddress);
  if (safeInfo.safe) {
    const owners = safeInfo.safe.owners;
    ownerIndex = owners
      .map(function (e) {
        return e.address;
      })
      .indexOf(rawAddr);
    if (ownerIndex !== -1) {
      output.innerText = "is Owner";
    } else output.innerText = "is not Owner";
  } else {
    output.innerText = "no safe found";
  }
  return;
}

async function genToken() {
  let output = window.document.querySelector("#output");
  recipient = document.getElementById("recipient").value;
  amount = document.getElementById("amount").value;
  if (!recipient | !amount) {
    window.alert("please fill all fields");
    return;
  }
  const rawSafeAddr = toRawAddress(safeAddress);
  const nanoAmount = window.TonWeb.utils.toNano(amount).toString();
  const reqVar = {
    chainId: chainId,
    safeAddress: rawSafeAddr,
    recipient: recipient,
    amount: nanoAmount,
  };
  try {
    const response = await fetch(`${baseUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query TonTransfer($chainId: String!, $safeAddress: String!, $amount: String!, $recipient: String!) {
              tonTransfer(chainId: $chainId, safeAddress: $safeAddress, amount: $amount, recipient: $recipient) {
                safeAddress
                chainId
                transfer {
                  sender
                  recipient
                  direction
                  transferInfo {
                    native {
                      transferType
                      value
                    }
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
                }
              }
            }`,
        variables: reqVar,
      }),
    });
    if (response.status === 200) {
      const result = await response.json();
      if (result.error) {
        console.log(result.error);
        throw new Error("GraphQL API Failed");
      }
      if (result.data.safe === null) console.log("no Data");
      res = result.data;
    }
  } catch (e) {
    console.log(e);
  }
  orderCellBoc = res.tonTransfer.multiSigExecutionInfo.orderCellBoc;
  output.innerText = "get payload successfully";
  window.document.getElementById("orderCellBoc").value = orderCellBoc;
}

async function sign() {
  await connect();
  const [cell] = Cell.fromBoc(orderCellBoc);
  const orderHash = bytesToHex(await cell.hash());
  const signature = await provider.send("ton_rawSign", {
    data: orderHash,
  });
  let output = window.document.querySelector("#output1");
  output.innerText = "signature: " + signature;
  res.tonTransfer.multiSigExecutionInfo.confirmations[ownerIndex] = signature;
  //   res.tonTransfer.transfer.transferInfo.native.value = "1";
  console.log(res);
}
async function create() {
  const reqVar = { content: res.tonTransfer };
  console.log(reqVar);
  queryId = res.tonTransfer.multiSigExecutionInfo.queryId;
  try {
    const response = await fetch(`${baseUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `mutation CreateTransfer($content: createTransferReq!) {
            createTransfer(content: $content) {
              success
              error {
                code
                detail
                extra
              }
            }
          }`,
        variables: reqVar,
      }),
    });
    if (response.status === 200) {
      const result = await response.json();
      if (result.error) {
        console.log(result.error);
        throw new Error("GraphQL API Failed");
      }
      if (result.data.safe === null) console.log("no Data");
    }
  } catch (e) {
    console.log(e);
  }
  window.document.getElementById("queryId").value = queryId;
}
async function search() {
  try {
    const response = await fetch(`${baseUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query SingleTransaction($queryId: String!) {
            singleTransaction(queryId: $queryId) {
              details {
                from
                to
                value
                dataHex
                hash
                executedAt
                fee
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
                }
              }
            }
          }`,
        variables: { queryId: queryId },
      }),
    });
    if (response.status === 200) {
      const result = await response.json();
      if (result.error) {
        console.log(result.error);
        throw new Error("GraphQL API Failed");
      }
      if (result.data.safe === null) console.log("no Data");
      stat = result.data;
    }
  } catch (e) {
    console.log(e);
  }
  let output = window.document.querySelector("#status");
  output.innerText = "status: " + stat.singleTransaction.summary.status;
}
async function balance() {
  const rawAddr = toRawAddress(safeAddress);
  const reqVar = {
    chainId: chainId,
    safeAddress: rawAddr,
  };
  try {
    const response = await fetch(`${baseUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query Balance($chainId: String!, $safeAddress: String!) {
                balance(chainId: $chainId, safeAddress: $safeAddress) {
                  fiatTotal
              }}`,
        variables: reqVar,
      }),
    });
    if (response.status === 200) {
      const result = await response.json();
      if (result.error) {
        console.log(result.error);
        throw new Error("GraphQL API Failed");
      }
      if (result.data.safe === null) console.log("no Data");
      const balance = result.data.balance.fiatTotal;
      let output = window.document.querySelector("#balance");
      output.innerText = "balance: " + balance + " USD";
    }
  } catch (e) {
    console.log(e);
  }
}
