module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('CV_Skills', {
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
      SkillId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Skills',
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
    return queryInterface.dropTable('CV_Skills');
  },
};
