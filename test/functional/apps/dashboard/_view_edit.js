/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import expect from 'expect.js';

export default function ({ getService, getPageObjects }) {
  const testSubjects = getService('testSubjects');
  const kibanaServer = getService('kibanaServer');
  const retry = getService('retry');
  const remote = getService('remote');
  const queryBar = getService('queryBar');
  const dashboardAddPanel = getService('dashboardAddPanel');
  const PageObjects = getPageObjects(['dashboard', 'header', 'common', 'visualize']);
  const dashboardName = 'Dashboard View Edit Test';

  describe('dashboard view edit mode', function viewEditModeTests() {
    before(async function () {
      await PageObjects.dashboard.initTests();
      await PageObjects.dashboard.preserveCrossAppState();
      await kibanaServer.uiSettings.disableToastAutohide();
      await remote.refresh();
    });

    after(async function () {
      await PageObjects.dashboard.gotoDashboardLandingPage();
    });

    it('create new dashboard opens in edit mode', async function () {
      await PageObjects.dashboard.clickNewDashboard();
      await PageObjects.dashboard.clickCancelOutOfEditMode();
    });

    it('create test dashboard', async function () {
      await PageObjects.dashboard.gotoDashboardLandingPage();
      await PageObjects.dashboard.clickNewDashboard();
      await dashboardAddPanel.addVisualizations(PageObjects.dashboard.getTestVisualizationNames());
      const isDashboardSaved = await PageObjects.dashboard.saveDashboard(dashboardName);
      expect(isDashboardSaved).to.eql(true);
    });

    it('existing dashboard opens in view mode', async function () {
      await PageObjects.dashboard.gotoDashboardLandingPage();
      await PageObjects.dashboard.selectDashboard(dashboardName);
      const inViewMode = await PageObjects.dashboard.getIsInViewMode();

      expect(inViewMode).to.equal(true);
    });

    describe('save', function () {
      it('auto exits out of edit mode', async function () {
        await PageObjects.dashboard.gotoDashboardEditMode(dashboardName);
        await PageObjects.dashboard.saveDashboard(dashboardName);
        const isViewMode = await PageObjects.dashboard.getIsInViewMode();
        expect(isViewMode).to.equal(true);
      });
    });

    describe('shows lose changes warning', async function () {
      describe('and loses changes on confirmation', function () {
        beforeEach(async function () {
          await PageObjects.dashboard.gotoDashboardEditMode(dashboardName);
        });


        it.skip('when time changed is stored with dashboard', async function () {
          const originalFromTime = '2015-09-19 06:31:44.000';
          const originalToTime = '2015-09-19 06:31:44.000';
          await PageObjects.header.setAbsoluteRange(originalFromTime, originalToTime);
          await PageObjects.dashboard.saveDashboard(dashboardName, { storeTimeWithDashboard: true });

          await PageObjects.dashboard.clickEdit();
          await PageObjects.header.setAbsoluteRange('2013-09-19 06:31:44.000', '2013-09-19 06:31:44.000');
          await PageObjects.dashboard.clickCancelOutOfEditMode();

          // confirm lose changes
          await PageObjects.common.clickConfirmOnModal();

          const newFromTime = await PageObjects.header.getFromTime();
          const newToTime = await PageObjects.header.getToTime();

          expect(newFromTime).to.equal(originalFromTime);
          expect(newToTime).to.equal(originalToTime);
        });

        it('when the query is edited and applied', async function () {
          const originalQuery = await queryBar.getQueryString();
          await queryBar.setQuery(`${originalQuery} and extra stuff`);
          await queryBar.submitQuery();

          await PageObjects.dashboard.clickCancelOutOfEditMode();

          // confirm lose changes
          await PageObjects.common.clickConfirmOnModal();

          const query = await queryBar.getQueryString();
          expect(query).to.equal(originalQuery);
        });

        it('when a filter is deleted', async function () {
          await PageObjects.dashboard.setTimepickerInHistoricalDataRange();
          await PageObjects.dashboard.filterOnPieSlice();
          await PageObjects.dashboard.saveDashboard(dashboardName);

          // This may seem like a pointless line but there was a bug that only arose when the dashboard
          // was loaded initially
          await PageObjects.dashboard.loadSavedDashboard(dashboardName);
          await PageObjects.dashboard.clickEdit();
          const originalFilters = await retry.try(async () => {
            const filters = await PageObjects.dashboard.getFilters();
            if (!filters.length) throw new Error('expected filters');
            return filters;
          });
          // Click to cause hover menu to show up, but it will also actually click the filter, which will turn
          // it off, so we need to click twice to turn it back on.
          await originalFilters[0].click();
          await originalFilters[0].click();

          await testSubjects.click('removeFilter-memory');

          const noFilters = await PageObjects.dashboard.getFilters(1000);
          expect(noFilters.length).to.equal(0);

          await PageObjects.dashboard.clickCancelOutOfEditMode();

          // confirm lose changes
          await PageObjects.common.clickConfirmOnModal();

          const reloadedFilters = await PageObjects.dashboard.getFilters();
          expect(reloadedFilters.length).to.equal(1);
        });

        it('when a new vis is added', async function () {
          await dashboardAddPanel.ensureAddPanelIsShowing();
          await dashboardAddPanel.clickAddNewEmbeddableLink();
          await PageObjects.visualize.clickAreaChart();
          await PageObjects.visualize.clickNewSearch();
          await PageObjects.visualize.saveVisualization('new viz panel');

          await PageObjects.dashboard.clickCancelOutOfEditMode();

          // confirm lose changes
          await PageObjects.common.clickConfirmOnModal();

          const visualizations = PageObjects.dashboard.getTestVisualizations();
          const panelCount = await PageObjects.dashboard.getPanelCount();
          expect(panelCount).to.eql(visualizations.length);
        });

        it('when an existing vis is added', async function () {
          await dashboardAddPanel.addVisualization('new viz panel');
          await PageObjects.dashboard.clickCancelOutOfEditMode();

          // confirm lose changes
          await PageObjects.common.clickConfirmOnModal();

          const visualizations = PageObjects.dashboard.getTestVisualizations();
          const panelCount = await PageObjects.dashboard.getPanelCount();
          expect(panelCount).to.eql(visualizations.length);
        });
      });

      describe('and preserves edits on cancel', function () {
        it.skip('when time changed is stored with dashboard', async function () {
          await PageObjects.dashboard.gotoDashboardEditMode(dashboardName);
          const newFromTime = '2015-09-19 06:31:44.000';
          const newToTime = '2015-09-19 06:31:44.000';
          await PageObjects.header.setAbsoluteRange('2013-09-19 06:31:44.000', '2013-09-19 06:31:44.000');
          await PageObjects.dashboard.saveDashboard(dashboardName, true);
          await PageObjects.dashboard.clickEdit();
          await PageObjects.header.setAbsoluteRange(newToTime, newToTime);
          await PageObjects.dashboard.clickCancelOutOfEditMode();

          await PageObjects.common.clickCancelOnModal();
          await PageObjects.dashboard.saveDashboard(dashboardName, { storeTimeWithDashboard: true });

          await PageObjects.dashboard.loadSavedDashboard(dashboardName);

          const fromTime = await PageObjects.header.getFromTime();
          const toTime = await PageObjects.header.getToTime();

          expect(fromTime).to.equal(newFromTime);
          expect(toTime).to.equal(newToTime);
        });
      });
    });

    describe.skip('and preserves edits on cancel', function () {
      it('when time changed is stored with dashboard', async function () {
        await PageObjects.dashboard.gotoDashboardEditMode(dashboardName);
        const newFromTime = '2015-09-19 06:31:44.000';
        const newToTime = '2015-09-19 06:31:44.000';
        await PageObjects.header.setAbsoluteRange('2013-09-19 06:31:44.000', '2013-09-19 06:31:44.000');
        await PageObjects.dashboard.saveDashboard(dashboardName, true);
        await PageObjects.dashboard.clickEdit();
        await PageObjects.header.setAbsoluteRange(newToTime, newToTime);
        await PageObjects.dashboard.clickCancelOutOfEditMode();

        await PageObjects.common.clickCancelOnModal();
        await PageObjects.dashboard.saveDashboard(dashboardName, { storeTimeWithDashboard: true });

        await PageObjects.dashboard.loadSavedDashboard(dashboardName);

        const fromTime = await PageObjects.header.getFromTime();
        const toTime = await PageObjects.header.getToTime();

        expect(fromTime).to.equal(newFromTime);
        expect(toTime).to.equal(newToTime);
      });
    });

    describe('Does not show lose changes warning', async function () {
      it('when time changed is not stored with dashboard', async function () {
        await PageObjects.dashboard.gotoDashboardEditMode(dashboardName);
        await PageObjects.dashboard.saveDashboard(dashboardName, { storeTimeWithDashboard: false });
        await PageObjects.dashboard.clickEdit();
        await PageObjects.header.setAbsoluteRange('2013-10-19 06:31:44.000', '2013-12-19 06:31:44.000');
        await PageObjects.dashboard.clickCancelOutOfEditMode();

        const isOpen = await PageObjects.common.isConfirmModalOpen();
        expect(isOpen).to.be(false);
      });

      it('when a dashboard has a filter and remains unchanged', async function () {
        await PageObjects.dashboard.gotoDashboardEditMode(dashboardName);
        await PageObjects.dashboard.setTimepickerInHistoricalDataRange();
        await PageObjects.dashboard.filterOnPieSlice();
        await PageObjects.dashboard.saveDashboard(dashboardName);
        await PageObjects.dashboard.clickEdit();
        await PageObjects.dashboard.clickCancelOutOfEditMode();

        const isOpen = await PageObjects.common.isConfirmModalOpen();
        expect(isOpen).to.be(false);
      });

      // See https://github.com/elastic/kibana/issues/10110 - this is intentional.
      it('when the query is edited but not applied', async function () {
        await PageObjects.dashboard.gotoDashboardEditMode(dashboardName);

        const originalQuery = await queryBar.getQueryString();
        await queryBar.setQuery(`${originalQuery} extra stuff`);

        await PageObjects.dashboard.clickCancelOutOfEditMode();

        const isOpen = await PageObjects.common.isConfirmModalOpen();
        expect(isOpen).to.be(false);

        await PageObjects.dashboard.loadSavedDashboard(dashboardName);
        const query = await queryBar.getQueryString();
        expect(query).to.equal(originalQuery);
      });
    });
  });
}
