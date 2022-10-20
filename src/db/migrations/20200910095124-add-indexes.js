module.exports = {
  up: (queryInterface) => {
    return Promise.all([
      queryInterface.addIndex('CV_Ambitions', ['CVId']),
      queryInterface.addIndex('CV_BusinessLines', ['CVId']),
      queryInterface.addIndex('CV_Contracts', ['CVId']),
      queryInterface.addIndex('CV_Languages', ['CVId']),
      queryInterface.addIndex('CV_Locations', ['CVId']),
      queryInterface.addIndex('CV_Passions', ['CVId']),
      queryInterface.addIndex('CV_Skills', ['CVId']),

      queryInterface.addIndex('Reviews', ['CVId']),
      queryInterface.addIndex('Experiences', ['CVId']),
      queryInterface.addIndex('Experience_Skills', ['ExperienceId']),

      queryInterface.addIndex('User_Candidats', ['candidatId']),
    ]);
  },

  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeIndex('CV_Ambitions', ['CVId']),
      queryInterface.removeIndex('CV_BusinessLines', ['CVId']),
      queryInterface.removeIndex('CV_Contracts', ['CVId']),
      queryInterface.removeIndex('CV_Languages', ['CVId']),
      queryInterface.removeIndex('CV_Locations', ['CVId']),
      queryInterface.removeIndex('CV_Passions', ['CVId']),
      queryInterface.removeIndex('CV_Skills', ['CVId']),

      queryInterface.removeIndex('Reviews', ['CVId']),
      queryInterface.removeIndex('Experiences', ['CVId']),
      queryInterface.removeIndex('Experience_Skills', ['ExperienceId']),

      queryInterface.removeIndex('User_Candidats', ['candidatId']),
    ]);
  },
};
