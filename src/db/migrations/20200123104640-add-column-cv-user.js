export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Users', 'gender', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.removeColumn('CVs', 'firstName'),
      queryInterface.removeColumn('CVs', 'lastName'),
      queryInterface.addColumn('CVs', 'urlImg', Sequelize.STRING),
      queryInterface.addColumn('CVs', 'catchphrase', Sequelize.STRING),
      queryInterface.addColumn('CVs', 'devise', Sequelize.STRING),
      queryInterface.addColumn('Users', 'hiden', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      }),
      queryInterface.addColumn('Users', 'url', Sequelize.STRING),
      queryInterface.addColumn('CVs', 'careerPathOpen', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }),
      queryInterface.changeColumn('Experiences', 'dateEnd', {
        allowNull: true,
        type: Sequelize.STRING,
      }),
      queryInterface.renameColumn('CVs', 'userId', 'UserId'),
    ]);
  },
  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('Users', 'gender'),
      queryInterface.removeColumn('Users', 'url'),
      queryInterface.removeColumn('Users', 'hiden'),
      queryInterface.removeColumn('CVs', 'catchphrase'),
      queryInterface.removeColumn('CVs', 'devise'),
      queryInterface.removeColumn('CVs', 'careerPathOpen'),
      queryInterface.removeColumn('CVs', 'urlImg'),
      queryInterface.addColumn('CVs', 'firstName', {
        allowNull: false,
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('CVs', 'lastName', {
        allowNull: false,
        type: Sequelize.STRING,
      }),
      queryInterface.renameColumn('CVs', 'UserId', 'userId'),
    ]);
  },
};
