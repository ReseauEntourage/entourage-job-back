module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('CV_Languages', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      CVId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'CVs',
          key: 'id',
        },
      },
      LanguageId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Languages',
          key: 'id',
        },
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
    return queryInterface.dropTable('CV_Languages');
  },
};
