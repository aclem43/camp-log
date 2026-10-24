import { remult } from 'remult'

// Runs `what` inside a single DB transaction, routing every remult.repo()
// call made within it through that transaction - what @BackendMethod does for
// its body automatically, for plain Express routes. If `what` throws, every
// write it made is rolled back.
export async function inTransaction(what: () => Promise<void>) {
  const previous = remult.dataProvider
  try {
    await previous.transaction(async (trx) => {
      remult.dataProvider = trx
      await what()
    })
  }
  finally {
    remult.dataProvider = previous
  }
}
