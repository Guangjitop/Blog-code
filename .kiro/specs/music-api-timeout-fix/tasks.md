# Implementation Plan

- [x] 1. Update backend configuration for music API endpoints


  - Modify the `METING_API_URLS` configuration in `backend/main.py` to prioritize local endpoints
  - Add logic to detect Docker environment vs direct deployment
  - Set default endpoints: localhost/host.docker.internal first, then external IP
  - Ensure configuration reads from `METING_API_URL` environment variable
  - _Requirements: 1.1, 3.1, 5.1, 5.2, 5.3_

- [ ]* 1.1 Write property test for configuration parsing
  - **Property 6: Configuration parsing correctness**
  - **Validates: Requirements 5.1, 5.5**



- [ ] 2. Implement endpoint fallback logic in music API proxy
  - Refactor music API proxy functions to use sequential endpoint trying
  - Implement immediate fallback on connection errors (no timeout wait)
  - Ensure each endpoint is tried at most once per request
  - Add comprehensive error tracking for all attempts
  - _Requirements: 1.2, 3.2, 3.3, 3.5_

- [ ]* 2.1 Write property test for endpoint order preservation
  - **Property 1: Endpoint order preservation**
  - **Validates: Requirements 1.1, 3.1, 3.2, 5.4**

- [x]* 2.2 Write property test for automatic fallback

  - **Property 2: Automatic fallback on failure**
  - **Validates: Requirements 1.2, 3.3, 3.5**

- [ ] 3. Enhance error handling and logging
  - Add detailed logging for each endpoint attempt (timestamp, URL, result)
  - Implement structured error response format with all attempt details
  - Add log messages for fallback actions
  - Create summary log when all endpoints fail
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 3.1 Write property test for complete attempt logging
  - **Property 5: Complete attempt logging**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**



- [ ]* 3.2 Write property test for comprehensive error response
  - **Property 4: Comprehensive error response**
  - **Validates: Requirements 1.5, 2.5**

- [ ] 4. Ensure CORS headers are properly set
  - Verify all music API proxy endpoints add CORS headers to responses
  - Test that CORS headers are present in both success and error responses


  - _Requirements: 1.4_

- [ ]* 4.1 Write property test for CORS header injection
  - **Property 3: CORS header injection**
  - **Validates: Requirements 1.4**

- [ ] 5. Update frontend error handling
  - Parse new error response format with attempt details

  - Store last error message in state
  - Display error message when user switches to online music tab
  - _Requirements: 4.2_

- [ ]* 5.1 Write property test for frontend error handling
  - **Property 7: Frontend error handling**
  - **Validates: Requirements 4.2**

- [x] 6. Implement frontend UI improvements

  - Add automatic fallback to local music tab when online music fails
  - Add retry button for timeout errors
  - Ensure local music is prioritized when available
  - Add helpful guidance when no music is available
  - _Requirements: 4.1, 4.3, 4.4, 4.5_

- [ ]* 6.1 Write property test for UI fallback to local music
  - **Property 8: UI fallback to local music**
  - **Validates: Requirements 4.1, 4.4**

- [ ]* 6.2 Write property test for retry UI element
  - **Property 9: Retry UI element**
  - **Validates: Requirements 4.3**

- [ ]* 6.3 Write unit test for empty state guidance
  - Test that helpful guidance is displayed when no music is available
  - _Requirements: 4.5_

- [x] 7. Update deployment configuration


  - Add `METING_API_URL` to environment variable documentation
  - Update Docker compose files with appropriate default endpoints
  - Add deployment notes for Docker vs direct deployment
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 8. Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 9. Integration testing
  - Test with actual music API service running on localhost:3000
  - Test fallback behavior by stopping localhost service
  - Test from external network to verify end-to-end functionality
  - Verify logging output in real scenarios
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 10. Final checkpoint - Verify deployment


  - Ensure all tests pass, ask the user if questions arise.
