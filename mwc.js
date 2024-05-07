// function mwc(name, a, c, m, seed){
function mwc(name, a, c, x){
	Object.defineProperty(mwc, name, {
		value: function(){
			const t = (a * x + c) >>> 0;
			c = t; // >>> 32;
			x = t & 0xFFFFFFFF;
			console.log(t, c, x);
			return x+c;
		}
	});
	return mwc[name];
}

module.exports = {
	mwc
};
