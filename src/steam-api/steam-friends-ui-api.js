const SteamFriendsUiApi =  {
	define: (name, source) => {
		window[name] = eval("("+source+")");
	},

	getLoggedUserInfo: () => {
		return new UserInfo(g_FriendsUIApp.FriendStore.m_self);
	},

	findChatRoom: (groupName) => {
		let groupId = null;
		let group = null;
		for(let g of g_FriendsUIApp.ChatStore.m_mapChatGroups){
			if(g[1].name == groupName){
				groupId = g[0];
				group = g[1];
				break;
			}
		}
		if(group == null)
			return null;

		let lastMention = 0;
		let roomId = null;
		for(let r of group.m_mapRooms){
			if(r[1].m_rtLastMention > lastMention){
				lastMention = r[1].m_rtLastMention;
				roomId = r[0];
			}
		}
		return {
			groupId, roomId
		}
	},

	getGroups: () => [...g_FriendsUIApp.ChatStore.m_mapChatGroups.values()].map(
		g => {return {id: g.m_ulGroupID, name: g.name, tagLine: g.tagLine}}
	),

	getVoiceRooms: (groupId) => [...g_FriendsUIApp.ChatStore.m_mapChatGroups.get(groupId).m_mapRooms.values()]
		.filter(r => r.m_bVoiceAllowed)
		.map(r => {return {id: r.m_ulChatID, name: r.name}}),

	getGroupId: (name) => {
		for(let g of g_FriendsUIApp.ChatStore.m_mapChatGroups.values()){
			if(g.name == name){
				return g.GetGroupID();
			}
		}
		return null;
	},

	getGroupMembers: (groupId) => {
		let members = [];
		for(let bucket of g_FriendsUIApp.GroupMemberStore.GetGroupMemberList(groupId)){
			for(let f of bucket.m_rgMembers)
				members.push(new UserInfo(f));
		}
		return members;
	},

	getVoiceRoomUsers: () => {
		let users = [];
		// This won't work when bot leaves room: let voiceChat = g_FriendsUIApp.ChatStore.GetActiveVoiceChat();
		let voiceChat = window.currentVoiceChat;
		for(let m of voiceChat.m_groupVoiceActiveMembers.GetRawMemberList)
			users.push(new UserInfo(m));
		return users;
	},

	joinVoiceRoom: (groupId, channelName) => {
		let group = g_FriendsUIApp.ChatStore.GetChatRoomGroup(groupId);
		for(let voiceChannel of group.voiceRoomList){
			if(voiceChannel.name == channelName){
				voiceChannel.StartVoiceChat();
				window.currentVoiceChat = voiceChannel;
				break;
			}
		}
	},

	rejoinLastVoiceRoom: () => window.currentVoiceChat.StartVoiceChat(),

	getActiveVoiceRoom: () => g_FriendsUIApp.VoiceStore.GetActiveVoiceChatID()
};

export default SteamFriendsUiApi;