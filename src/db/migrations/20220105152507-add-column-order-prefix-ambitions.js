export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Ambitions', 'prefix', {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: 'dans',
      }),
      queryInterface.addColumn('Ambitions', 'order', {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: -1,
      }),
      queryInterface.removeColumn('CVs', 'careerPathOpen'),
    ]);
  },
  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('Ambitions', 'prefix'),
      queryInterface.removeColumn('Ambitions', 'order'),
      queryInterface.addColumn('CVs', 'careerPathOpen', {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      }),
    ]);
  },
};
