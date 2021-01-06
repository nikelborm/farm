// asd
module.exports = {
  apps : [{
    name: 'farm',
    script: 'index.js',
    watch: '.',
    ignore_watch: ["node_modules", ".git"]
  }],

  deploy : {
    production : {
      user : 'ubuntu',
      host : 'ubuntu',
      ref  : 'origin/main',
      repo : 'https://github.com/nikelborm/farm',
      'pre-deploy-local': 'yarn',
    }
  }
};
