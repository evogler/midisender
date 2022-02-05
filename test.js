/*
// const time = () => ((t) => (t[0] + t[1] / 1e9) * 1000)(process.hrtime());

const time = () => Number(new Date());

const startTime = time();

const printTime = () => {
  const t = time() - startTime;
  console.log(t);
};



setTimeout(() => {
  printTime();
}, 0);

setTimeout(printTime, 1000);
setTimeout(printTime, 2000);
setTimeout(printTime, 3000);
setTimeout(printTime, 4000);
*/