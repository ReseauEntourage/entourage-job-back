import moment from 'moment';

export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('CVs', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      firstname: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      lastname: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      intro: {
        type: Sequelize.TEXT,
      },
      contract: {
        type: Sequelize.STRING,
      },
      location: {
        type: Sequelize.STRING,
      },
      story: {
        type: Sequelize.TEXT,
      },
      status: {
        type: Sequelize.STRING,
      },
      transport: {
        type: Sequelize.STRING,
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
    return queryInterface.dropTable('CVs');
  },
};
