package com.pub_game_be.security;

import com.pub_game_be.reliability.DeviceSessionService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class SessionAuthenticationFilterTest {

    @Test
    void healthIsPublicWithoutSession() throws Exception {
        var filter = new SessionAuthenticationFilter(mock(DeviceSessionService.class));
        var request = new MockHttpServletRequest("GET", "/health");
        request.setServletPath("/health");
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).as("la richiesta supera il filtro").isNotNull();
    }

    @Test
    void otherRegiaRoutesStillNeedASession() throws Exception {
        var filter = new SessionAuthenticationFilter(mock(DeviceSessionService.class));
        var request = new MockHttpServletRequest("GET", "/health/segreto");
        request.setServletPath("/health/segreto");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(401);
    }
}
