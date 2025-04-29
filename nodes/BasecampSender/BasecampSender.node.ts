import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import axios from 'axios';

export class BasecampSender implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Basecamp Sender',
		name: 'basecampSender',
		icon: 'file:BasecampLogo.svg',
		group: ['output'],
		version: 1,
		triggerPanel: false,
		subtitle: 'Send message',
		description: 'Send message to message board',
		defaults: {
			name: 'Basecamp Sender',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'oAuth2Api',
				displayName: 'Basecamp credentials',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Account ID',
				name: 'account_id',
				type: 'string',
				required: true,
				default: '',
			},
			{
				displayName: 'Project ID',
				name: 'project_id',
				type: 'string',
				required: true,
				default: '',
			},
			{
				displayName: 'MessageBoard ID',
				name: 'message_board_id',
				type: 'string',
				required: true,
				default: '',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				default: '',
				typeOptions: {
					rows: 5,
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Status',
						name: 'status',
						type: 'string',
						default: 'active',
					},
					{
						displayName: 'Basecamp URL',
						name: 'basecamp_url',
						type: 'string',
						default: 'https://3.basecampapi.com',
						description: 'Basecamp base URL',
					},
					{
						displayName: 'Token URL',
						name: 'token_url',
						type: 'string',
						default: 'https://launchpad.37signals.com',
						description: 'Basecamp token URL',
					},
					{
						displayName: 'Put Response in Field',
						name: 'response_field',
						type: 'string',
						default: 'response',
						description: 'The name of the output field to put the response in',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		let item: INodeExecutionData;
		const returnItems: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			item = { ...items[itemIndex] };
			const newItem: INodeExecutionData = {
				json: item.json,
				pairedItem: {
					item: itemIndex,
				},
			};

			// Parameters & Options
			const account_id = this.getNodeParameter('account_id', itemIndex) as string;
			const project_id = this.getNodeParameter('project_id', itemIndex) as string;
			const message_board_id = this.getNodeParameter('message_board_id', itemIndex) as string;

			const subject = this.getNodeParameter('subject', itemIndex) as string;
			const content = this.getNodeParameter('content', itemIndex) as string;

			const options = this.getNodeParameter('options', itemIndex);
			const status = options.status ? (options.status as string) : 'active';
			const basecamp_url = options.basecamp_url
				? (options.basecamp_url as string)
				: 'https://3.basecampapi.com';
			const token_url = options.token_url
				? (options.token_url as string)
				: 'https://launchpad.37signals.com';

			const response_field = options.response_field
				? (options.response_field as string)
				: 'response';

			// oAuth Credentials
			const oAuthCredentials = (await this.getCredentials('oAuth2Api')) as any;
			const refreshToken = oAuthCredentials.oauthTokenData?.refresh_token;
			if (!refreshToken) {
				throw new NodeOperationError(this.getNode(), 'No refresh token available in credentials.');
			}

			const { clientId, clientSecret } = oAuthCredentials;

			const url = `${token_url}/authorization/token?type=refresh&refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}`;

			// Refresh the token
			const refreshCall = await axios.post(url);
			const newAccessToken = refreshCall.data.access_token;

			// Send message
			let messagePayload = {
				subject: subject,
				content: content,
				status: status,
			};

			const messageCall = await axios.post(
				`${basecamp_url}/${account_id}/buckets/${project_id}/message_boards/${message_board_id}/messages.json`,
				messagePayload,
				{
					headers: {
						Authorization: `Bearer ${newAccessToken}`,
						'Content-Type': 'application/json',
					},
				},
			);

			newItem.json[response_field] = messageCall.data;
			returnItems.push(newItem);
		}

		return [returnItems];
	}
}
