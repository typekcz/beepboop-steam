//@ts-check

export default class RoomInfo {
	constructor(room){
		this.name = room.name;
		this.id = room.m_ulChatID;
		this.groupId = room.m_ulGroupID;
		this.groupName = room.m_group.name;
	}
}