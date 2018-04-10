import React from 'react'
import recompact from 'recompact'

import isEqual from 'lodash.isequal'
import omit from 'lodash.omit'

const {
  compose,
  withState,
  lifecycle,
  branch,
  renderComponent,
} = recompact

const WITH_STATE_PROPS = ['_withTrackerState', '_setWithTrackerState']

const loadingHandler = () => <div>loading</div>
const errorHandler = () => <div>error</div>

let _defaults = {
  loadingHandler,
  errorHandler,
  pure: false,
  env: {},
}

export const setDefaults = defaults => Object.assign({}, _defaults, defaults)

//

const initialState = withState(WITH_STATE_PROPS[0], WITH_STATE_PROPS[1], false)

const trackReactiveSource = (tracker, options) => lifecycle({
  componentWillMount() {
  },

  componentWillReceiveProps(nextProps) {
    if (isEqual(omit(this.props, WITH_STATE_PROPS), omit(nextProps, WITH_STATE_PROPS))) return
    this.trackerHandler = tracker(this.props, this._onData, { ..._defaults.env })
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (options.shouldUpdate)
      return options.shouldUpdate(this.props, nextProps, this.state, nextState)

    if (!_defaults.pure)
      return true

    return !isEqual(this.props, nextProps) || !isEqual(this.state, nextState)
  },

  componentDidMount() {
    this._onData = (err, nextProps) => err
      ? this.props._setWithTrackerState(err)
      : this.setState(nextProps, () => this.props._setWithTrackerState(true))

    this.handler = Tracker.nonreactive(() => Tracker.autorun(() => {
      this.trackerHandler = tracker(this.props, this._onData, { ..._defaults.env })
    }))
  },

  componentWillUnmount() {
    const { trackerHandler, handler } = this
    if (typeof trackerHandler === 'function' && trackerHandler.name !== '_onData')
      trackerHandler()

    handler && handler.stop()
  },
})

const checkState = ({ _withTrackerState: state }) => typeof state === 'boolean' ? !state : true

const StateComponent = options => ({ _withTrackerState: state, ...props }) => {
  if (typeof state === 'boolean')
    return options.loadingHandler && options.loadingHandler(props) || _defaults.loadingHandler()

  return options.errorHandler ? options.errorHandler(state, props) : _defaults.errorHandler()
}

const branchTrackerState = options => branch(checkState, renderComponent(StateComponent(options)))

//

const withTracker = (tracker, options = {}) => compose(
  initialState,
  trackReactiveSource(tracker, options),
  branchTrackerState(options),
)

recompact.composeWithTracker = recompact.withTracker = withTracker

export default recompact
