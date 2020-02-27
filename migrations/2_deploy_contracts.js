const RelayHub = artifacts.require('./RelayHub.sol')
const TrustedForwarder = artifacts.require('./TrustedForwarder.sol')
const TestRecipient = artifacts.require('./test/TestRecipient.sol')
const TestSponsor = artifacts.require('./test/TestSponsorEverythingAccepted.sol')

module.exports = async function (deployer) {
  await deployer.deploy( TrustedForwarder )
  await deployer.deploy(RelayHub, TrustedForwarder.address, { gas: 8000000 })
  const testRecipient = await deployer.deploy(TestRecipient)
  const testSponsor = await deployer.deploy(TestSponsor)
  await testRecipient.setHub(RelayHub.address)
  await testSponsor.setHub(RelayHub.address)
}
                                                                                   - 0
