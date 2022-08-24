module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('CV_BusinessLines', 'id', {
      type: Sequelize.UUID,
      unique: true,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('uuid_generate_v4()'),
    });
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('CV_BusinessLines', 'id');
  },
};
