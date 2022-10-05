import * as assert from 'assert';

import constants from '../utils/constants';

const staticPage = locate({ css: 'div[data-testid="static-page"]' });

const borderBottom = '1px solid rgba(255, 255, 255, 0.12)';
const fontWeight = '700';

Feature('static page').retry(Number(process.env.TEST_RETRY_COUNT) || 0);

Before(({ I }) => {
  I.useConfig('test--no-cleeng');
});

Scenario('I can see the markdown correctly being rendered', async ({ I }) => {
  I.amOnPage(constants.staticPageUrl);

  await I.checkStyle(locate('h1').inside(staticPage), {
    margin: '0px 0px 32px',
    'font-weight': fontWeight,
    'padding-bottom': '9.6px',
    'font-size': '32px',
    'line-height': '42.56px',
    'border-bottom': borderBottom,
  });

  await I.checkStyle(locate('h2').inside(staticPage), {
    margin: '0px 0px 24px',
    'font-weight': fontWeight,
    'padding-bottom': '7.2px',
    'font-size': '24px',
    'line-height': '31.92',
    'border-bottom': borderBottom,
  });

  await I.checkStyle(locate('h3').inside(staticPage), {
    margin: '0px 0px 20px',
    'font-weight': fontWeight,
    'line-height': '26.6px',
    'font-size': '20px',
  });

  await I.checkStyle(locate('h4').inside(staticPage), {
    margin: '0px 0px 16px',
    'font-weight': fontWeight,
    'line-height': '21.28',
    'font-size': '16px',
  });

  await I.checkStyle(locate('h5').inside(staticPage), {
    margin: '0px 0px 14px',
    'font-weight': fontWeight,
    'line-height': '18.62px',
    'font-size': '14px',
  });

  await I.checkStyle(locate('h6').inside(staticPage), {
    margin: '0px 0px 13.6px',
    'font-weight': fontWeight,
    'line-height': '18.088px',
    'font-size': '13.6px',
  });

  await I.checkStyle(locate('hr').inside(staticPage), {
    'box-sizing': 'content-box',
    height: '4px',
    margin: '24px 0',
    padding: '0',
    overflow: 'hidden',
    background: 'transparent',
    'background-color': borderBottom,
    border: '0',
  });

  await I.checkStyle(locate('a').inside(staticPage), {
    'text-decoration': 'none',
  });

  await I.checkStyle(locate('h6').inside(staticPage), {
    'box-sizing': 'content-box',
    'max-width': '100%',
    'background-color': 'theme.$secondary-color',
  });

  await I.checkStyle(locate('ul').inside(staticPage), {
    'font-size': '16px',
    'list-style-type': 'disc',
    margin: '19.2px 0px 0px',
  });

  await I.checkStyle(locate('ol').inside(staticPage), {
    'font-size': '16px',
    'list-style-type': 'decimal',
    margin: '19.2px 0px 0px',
  });

  await I.checkStyle(locate('li').inside(staticPage), {
    'list-style-type': 'disc',
  });

  await I.checkStyle(locate('p').inside(staticPage), {
    'font-size': '16px',
    margin: '19.2px 0px 0px',
  });

  await I.checkStyle(locate('strong').inside(staticPage), {
    'font-size': '16px',
    'font-weight': fontWeight,
    margin: '19.2px 0px 0px',
  });

  await I.checkStyle(locate('em').inside(staticPage), {
    'font-size': '16px',
    margin: '19.2px 0px 0px',
  });
});
