const EventEmitter = require('events');
class AgentEventBus extends EventEmitter {}
const agentEvents = new AgentEventBus();
module.exports = { agentEvents };

export {};
