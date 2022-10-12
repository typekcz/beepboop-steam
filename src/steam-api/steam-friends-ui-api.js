const SteamFriendsUiApi =  {
	define: (name, source) => {
		window[name] = eval("("+source+")");
	},

	getLoggedUserInfo: () => {
		return new UserInfo(g_FriendsUIApp.FriendStore.m_self);
	},

	getUserByAccId: (accId) => {
		let u = g_FriendsUIApp.m_FriendStore.GetPlayer(accId);
		if(u)
			return new UserInfo(u);
		return null;
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
			for(let m of bucket.member_list)
				members.push(new UserInfo(m));
		}
		return members;
	},

	getVoiceRoomUsers: () => {
		let users = [];
		// This won't work when bot leaves room: let voiceChat = g_FriendsUIApp.ChatStore.GetActiveVoiceChat();
		let voiceChat = g_FriendsUIApp.ChatStore.GetChatRoomGroup(g_FriendsUIApp.VoiceStore.GetActiveChatRoomGroupID()).GetChatRoom(g_FriendsUIApp.VoiceStore.GetActiveVoiceChatID());
		for(let m of voiceChat.m_groupVoiceActiveMembers.GetRawMemberList)
			users.push(new UserInfo(m));
		return users;
	},

	joinVoiceRoom: async (groupId, channelName) => {
		// Make group active so that members can be retrieved
		g_FriendsUIApp.ChatStore.IncRefActiveChatRoomGroup(groupId, true);
		await g_FriendsUIApp.ChatStore.SendActiveChatRoomGroupsToServer();
		g_FriendsUIApp.GroupMemberStore.RegisterForGroupMemberList(() => {}, groupId);
		g_FriendsUIApp.GroupMemberStore.PerformInitialPopulate(groupId);

		let group = g_FriendsUIApp.ChatStore.GetChatRoomGroup(groupId);
		for(let voiceChannel of group.voiceRoomList){
			if(voiceChannel.name == channelName){
				voiceChannel.StartVoiceChat();
				window.currentVoiceChat = voiceChannel;

				let UpdateChatState_ = voiceChannel.UpdateChatState;
				voiceChannel.UpdateChatState = function(state){
					if(handleUsersChanged && this === window.currentVoiceChat)
						handleUsersChanged([...this.m_groupVoiceActiveMembers.GetCurrentMemberSet().values()], state.array[3]);
					return UpdateChatState_.apply(this, arguments);
				};
				break;
			}
		}
	},

	rejoinLastVoiceRoom: () => window.currentVoiceChat.StartVoiceChat(),

	getActiveVoiceRoom: () => g_FriendsUIApp.VoiceStore.GetActiveVoiceChatID(),

	leaveVoiceRoom: () => g_FriendsUIApp.VoiceStore.EndVoiceChatInternal()
};

export default SteamFriendsUiApi;