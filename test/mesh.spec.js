const should = require('should');
const seneca = require('seneca');
const async = require('async');

describe('seneca-mesh', () => {
  it('should load-balance when multiple instances provide same pin', function(done) {
    this.timeout(5000);

    // Define a microservice plugin, which assigns and return a random instanceId for any microservice instance
    const instanceIdPlugin = function() {
      this.instanceId = 38817823 * Math.random();
      this.add('cmd:getInstanceId', (msg, respond) => {
        respond(null, {instanceId: this.instanceId});
      });
    };

    // Instantiate a seneca mesh base
    const baseMicroservice = seneca();
    baseMicroservice.use('mesh', {isbase: true});

    // Instantiate a microservice using instanceIdPlugin, and make it join the mesh
    const microservice1 = seneca();
    microservice1.use(instanceIdPlugin).use('mesh', {pin:'cmd:getInstanceId'});

    // Instantiate another microservice using instanceIdPlugin, and make it join the mesh
    const microservice2 = seneca();
    microservice2.use(instanceIdPlugin).use('mesh', {pin:'cmd:getInstanceId'});

    // Instantiate Consumer Microservice, which will consume the other microservices in the mesh
    const consumerMicroservice = seneca();
    consumerMicroservice.use('mesh');

    async.parallel([
      baseMicroservice.ready,
      microservice1.ready,
      microservice2.ready,
      consumerMicroservice.ready
    ], (err) => {
      if(err) { return done(err); }

      // When called 3 times, the first and the third instanceIds should be equal, and the second should be different from them.
      let firstInstanceId, secondInstanceId, thirdInstanceId;

      consumerMicroservice.act('cmd:getInstanceId', (err, firstResponse) => {
        if(err) { return done(err); }
        consumerMicroservice.act('cmd:getInstanceId', (err, secondResponse) => {
          if(err) { return done(err); }
          consumerMicroservice.act('cmd:getInstanceId', (err, thirdResponse) => {
            firstResponse.instanceId.should.be.exactly(thirdResponse.instanceId);
            firstResponse.instanceId.should.not.be.exactly(secondResponse.instanceId);
            done();
          });
        });
      });
    });
  });
});
