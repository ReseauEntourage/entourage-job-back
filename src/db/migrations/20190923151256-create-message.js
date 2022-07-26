import moment from 'moment';

export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Messages', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      firstName: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      lastName: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      email: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      phone: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      job: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      businessLine: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      company: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      localization: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      message: {
        allowNull: false,
        type: Sequelize.TEXT,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: () => {
          return moment(new Date());
        },
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: () => {
          return moment(new Date());
        },
      },
    });
  },
  down: (queryInterface) => {
    return queryInterface.dropTable('Messages');
  },
};
