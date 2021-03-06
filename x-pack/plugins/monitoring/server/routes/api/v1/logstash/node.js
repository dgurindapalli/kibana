/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import Joi from 'joi';
import { getNodeInfo } from '../../../../lib/logstash/get_node_info';
import { handleError } from '../../../../lib/errors';
import { getMetrics } from '../../../../lib/details/get_metrics';
import { prefixIndexPattern } from '../../../../lib/ccs_utils';
import { metricSets } from './metric_set_node';

const { advanced: metricSetAdvanced, overview: metricSetOverview } = metricSets;

/*
 * Logstash Node route.
 */
export function logstashNodeRoute(server) {
  /**
   * Logtash Node request.
   *
   * This will fetch all data required to display a Logstash Node page.
   *
   * The current details returned are:
   *
   * - Logstash Node Summary (Status)
   * - Metrics
   */
  server.route({
    method: 'POST',
    path: '/api/monitoring/v1/clusters/{clusterUuid}/logstash/node/{logstashUuid}',
    config: {
      validate: {
        params: Joi.object({
          clusterUuid: Joi.string().required(),
          logstashUuid: Joi.string().required()
        }),
        payload: Joi.object({
          ccs: Joi.string().optional(),
          timeRange: Joi.object({
            min: Joi.date().required(),
            max: Joi.date().required()
          }).required(),
          is_advanced: Joi.boolean().required()
        })
      }
    },
    async handler(req, reply) {
      const config = server.config();
      const ccs = req.payload.ccs;
      const clusterUuid = req.params.clusterUuid;
      const lsIndexPattern = prefixIndexPattern(config, 'xpack.monitoring.logstash.index_pattern', ccs);
      const logstashUuid = req.params.logstashUuid;

      let metricSet;
      if (req.payload.is_advanced) {
        metricSet = metricSetAdvanced;
      } else {
        metricSet = metricSetOverview;
        // set the cgroup option if needed
        const showCgroupMetricsLogstash = config.get('xpack.monitoring.ui.container.logstash.enabled');
        const metricCpu = metricSet.find(m => m.name === 'logstash_node_cpu_metric');
        if (showCgroupMetricsLogstash) {
          metricCpu.keys = ['logstash_node_cgroup_quota_as_cpu_utilization'];
        } else {
          metricCpu.keys = ['logstash_node_cpu_utilization'];
        }
      }

      try {
        const [ metrics, nodeSummary ] = await Promise.all([
          getMetrics(req, lsIndexPattern, metricSet),
          getNodeInfo(req, lsIndexPattern, { clusterUuid, logstashUuid }),
        ]);

        reply({
          metrics,
          nodeSummary,
        });
      } catch(err) {
        reply(handleError(err, req));
      }
    }
  });
}
