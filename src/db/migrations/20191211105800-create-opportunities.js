module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Opportunities', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Public',
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      company: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      recruiterName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      recruiterMail: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      recruiterPhone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      date: Sequelize.DATE,
      location: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: Sequelize.NOW,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: (queryInterface) => {
    return queryInterface.dropTable('Opportunities');
  },
};
