const karma = require('karma');
const app = require('./testServer');

require('./server.spec.js');
const server = app.listen(3000, 'localhost', async () => {
	console.log('Test server started');
	try{
		const config = karma.config.parseConfig(__dirname + '/karma.server.conf.js', {});
		const server = new karma.Server(config);
		server.start();
		await new Promise(resolve => server.on('run_complete', resolve));
		console.log('Karma tests completed successfully');
	}catch(error){
		console.error('Error running Karma tests:', error);
	}finally{
		server.close(() => {
			console.log('Test server closed');
		});
	}
});
