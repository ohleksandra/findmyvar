import { PluginMessage } from '../types/message';

export default function messageRouter(msg: PluginMessage) {
	console.log('Received message:', msg);

	// switch (msg.type) {
	//       case 'findVar':
	//           handleFindVar(msg);
	//           break;
	//       case 'updateVar':
	//           handleUpdateVar(msg);
	//           break;
	//       // Add more cases as needed
	//       default:
	//           console.warn('Unknown message type:', msg.type);
	//   }
}
