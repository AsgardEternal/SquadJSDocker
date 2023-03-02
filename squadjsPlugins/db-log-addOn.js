import Sequelize from 'sequelize';

import DBLog from './db-log.js';

const { DataTypes } = Sequelize;

export default class DBLogPlayerTime extends DBLog {
  static get description() {
    return (
                'replacement add-on to dblog for player join/seeding times'
    );
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      ...DBLog.optionsSpecification,
          seedingThreshold: {
                required: false,
                description: 'seeding Threshold.',
                default: 50
          }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

        this.seeding = false;

        this.createModel(
                'PlayerTime',
                {
                        id: {
                                type: DataTypes.INTEGER,
                                primaryKey: true,
                                autoIncrement: true
                        },
                        joinTime: {
                                type: DataTypes.DATE
                        },
                        leaveTime: {
                                type: DataTypes.DATE
                        },
                        seedTime: {
                                type: DataTypes.DATE
                        },
                        joinedSeeding: {
                                type: DataTypes.BOOLEAN
                        }
                },
                {
                        charset: 'utf8mb4',
                        collate: 'utf8mb4_unicode_ci'
                }
        );

        this.models.Server.hasMany(this.models.PlayerTime, {
                foreignKey: { name: 'server', allowNull: false },
                onDelete: 'CASCADE'
        });

        this.models.SteamUser.hasMany(this.models.PlayerTime, {
                foreignKey: {name: 'player' },
                onDelete: 'CASCADE'
        });

        this.onPlayerConnected = this.onPlayerConnected.bind(this);
        this.onPlayerDisconnected = this.onPlayerDisconnected.bind(this);
  }

  async prepareToMount() {
    await super.prepareToMount();
    await this.models.PlayerTime.sync();
    
  }

  async mount() {
    await super.mount();
    this.server.on('PLAYER_CONNECTED', this.onPlayerConnected);
    this.server.on('PLAYER_DISCONNECTED', this.onPlayerDisconnected);
  }
  
  async repairDB() {
    await super.repairDB();
    let lastTickTime = this.models.TickRate.findOne(
      { where: { server: this.options.overrideServerID || this.server.id},
      order: [['id', 'DESC']]}
    );
    let lastServerTime = lastTickTime.time;
    let playerOnlineID = [];
    console.log(this.players);
    for (player of this.players){
      playerOnlineID.push(player.steamID);
    }
    const {not} = Sequelize.Op;
    this.models.PlayerTime.update(
      { leaveTime: lastServerTime },
      { where: { 
        leaveTime: null, 
        server: this.options.overrideServerID || this.server.id, 
        [not]: [{player: playerOnlineID}]
      } }
    );
  }

  async unmount() {
    this.models.PlayerTime.update(
      { leaveTime: 0 },
      { where: { leaveTime: null , server: this.options.overrideServerID || this.server.id } }
    );
    await super.unmount();
    this.server.removeEventListener('PLAYER_CONNECTED', this.onPlayerConnected);
    this.server.removeEventListener('PLAYER_DISCONNECTED', this.onPlayerDisconnected);
  }

  async onUpdatedA2SInformation(info) {
    await super.onUpdatedA2SInformation(info);
        
    if((this.seeding == true) && (info.a2sPlayerCount >= this.options.seedingThreshold)){
      console.log('switching to Live');
      this.seeding = false;
      let curDateTime = new Date();
      let timeNow = curDateTime.getFullYear() + '-' + (curDateTime.getMonth() + 1) + '-' + curDateTime.getDate()+' '+curDateTime.getHours()+':'+curDateTime.getMinutes()+':'+curDateTime.getSeconds();
      console.log(timeNow);
      await this.models.PlayerTime.update(
        { seedTime: timeNow },
        { where: { seedTime: null, joinedSeeding: 1, leaveTime: null, server: this.options.overrideServerID || this.server.id } }
      );
      }else if(this.seeding == false && (info.a2sPlayerCount-20) < this.options.seedingThreshold){
        console.log('switching to seeding');
        this.seeding = true;
      }
  }

  async onPlayerConnected(info) {
    console.log(info);
        if(info.player){
          await this.models.SteamUser.upsert({
        steamID: info.player.steamID,
        lastName: info.player.name
      });
        await this.models.PlayerTime.create({
                server: this.options.overrideServerID || this.server.id,
                player: info.steamID,
                joinTime: info.time,
                joinedSeeding: this.seeding
        });}
    else console.log('player is null');
  }

  async onPlayerDisconnected(info) {
    console.log(info);
        if(info.player){
          await this.models.SteamUser.upsert({
        steamID: info.player.steamID,
        lastName: info.player.name
      });}
          await this.models.PlayerTime.update(
                { leaveTime: info.time },
                { where: { player: info.steamID, leaveTime: null, server: this.options.overrideServerID || this.server.id } }
          );
  }
}
