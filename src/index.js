const { router, line } = require('bottender/router');

const handleLineMessage = require('./line/message.js');

module.exports = async function App() {
  return router([line.message(await handleLineMessage)]);
};
